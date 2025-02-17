import {
  AuthClient,
  ExternalAccountClientOptions,
  GoogleAuth,
  GoogleAuthOptions,
  ImpersonatedOptions,
  JWTOptions,
  OAuth2ClientOptions,
  UserRefreshClientOptions,
} from "google-auth-library";
import { JSONClient } from "google-auth-library/build/src/auth/googleauth";

interface CredentialBody {
  client_email?: string;
  private_key?: string;
  [key: string]: any;
}

interface TimeSeriesResponse {
  timeSeries: Array<TimeSeries>;
}

interface TimeSeries {
  metric: Metric;
  points: Array<Point>;
}

interface Metric {
  labels: {
    module: "__unknown__";
    version: "__unknown__";
    [key: string]: string; // loosely typed because there is no definite keys.
  };
}

interface Point {
  interval: Interval;
  value: {
    int64Value: string;
  };
}

export interface Interval {
  startTime: string;
  endTime: string;
}

export interface TimeIntervalMetric {
  interval: Interval;
  count: number;
  [key: string]: any; // loosely typed because there is no definite keys.
}

export type DateTimeStringISO =
  `${number}-${number}-${number}T${number}:${number}:${number}Z`;

interface FirestoreMetricsArgs extends Omit<GoogleAuthOptions, "scopes"> {}

export class FirestoreMetrics {
  projectId: string | null = null;
  private accessToken: string | null = null;
  private googleAuth: GoogleAuth | null = null;
  private googleAuthArgs: GoogleAuthOptions;
  private baseUrl = "https://monitoring.googleapis.com/v3/projects";
  private scopes: Array<string> = [
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/monitoring",
    "https://www.googleapis.com/auth/monitoring.read",
  ];

  constructor(params: FirestoreMetricsArgs) {
    this.googleAuthArgs = { ...params };
    this.projectId = params.projectId ?? null;
  }

  /**
   * Helper function to compose the metric type filter.
   * @param {string} metricName Name of the metric type.
   * @returns {string} A string filter to be passed to the request.
   */
  private metricFilter(metricName: string): string {
    const encodedMetricName = encodeURI(metricName);
    return `filter=metric.type%20%3D%20%22firestore.googleapis.com%2F${encodedMetricName}%22`;
  }

  /**
   * Creates a Google Auth instance if null.
   */
  private createGoogleAuthInstance() {
    if (this.googleAuth === null) {
      this.googleAuth = new GoogleAuth({
        ...this.googleAuthArgs,
        scopes: this.scopes,
      });
    }
  }

  /**
   * Gets the project ID and sets its value if it is still null.
   */
  async getProjectId(): Promise<string> {
    this.createGoogleAuthInstance();
    this.projectId = this.projectId || (await this.googleAuth.getProjectId());
    return this.projectId;
  }

  /**
   * Generates an access token.
   * @param {boolean} overwriteExisting If true, overwrites the existing access token.
   * @returns {Promise<string>} Access token used to authenticate requests.
   */
  async generateToken(overwriteExisting: boolean = true): Promise<string> {
    if (this.accessToken === null || overwriteExisting === true) {
      this.createGoogleAuthInstance();
      this.accessToken = await this.googleAuth.getAccessToken();
    }

    // Makes sure that the project id is always loaded before being used.
    await this.getProjectId();
    return this.accessToken;
  }

  /**
   * Sets the access token.
   * @param {boolean} accessToken Value of the new access token.
   */
  setAccessToken(accessToken: string) {
    this.accessToken = accessToken;
    return;
  }

  /**
   * Makes a request to the Cloud monitoring API.
   * @param {string} filter A monitoring filter that specifies which time series should be returned.
   * @param {string} startTime The beginning of the time interval.
   * @param {string} endTime The end of the time interval.
   * @returns
   */
  private async makeRequest(
    filter: string,
    startTime: string,
    endTime: string
  ) {
    const encodedStartTime = encodeURI(startTime);
    const encodedEndTime = encodeURI(endTime);
    const timeInterval = `interval.endTime=${encodedEndTime}&interval.startTime=${encodedStartTime}`;
    const url = `${this.baseUrl}/${this.projectId}/timeSeries?${filter}&${timeInterval}`;
    const response = await fetch(url, {
      headers: {
        accept: "*/*",
        authorization: `Bearer ${this.accessToken}`,
      },
      body: null,
      method: "GET",
    });

    if (response.status !== 200) {
      const errMesage = await response.text();
      throw Error(errMesage);
    }

    return response;
  }

  /**
   * Check if the list contains an the object.
   * @param obj Object.
   * @param list List of objects.
   * @returns True if the list contains the object.
   */
  private containsObject(obj: Object, list: Array<Object>) {
    if (JSON.stringify(list).includes(JSON.stringify(obj))) {
      return true;
    }

    return false;
  }

  /**
   * Removes keys in an object with null, undefined, etc. value.
   * @param obj Object.
   * @param args Additional values to be removes.
   * @returns An object with keys with invalid values removed.
   */
  private cleanObject(obj: Object, ...args: any[]) {
    const invalidValues = [null, undefined, ...args];
    for (let propName in obj) {
      if (invalidValues.includes(obj[propName])) {
        delete obj[propName];
      }
    }
    return obj;
  }

  /**
   * Cleans/formats the response into something more understandable.
   * @param {Response} response Fetch response.
   * @returns {Promise<Array<TimeIntervalMetric>>} An array of time intervals and count of transactions for that time.
   */
  private async cleanResponseTimeSeries(
    response: Response
  ): Promise<Array<TimeIntervalMetric>> {
    const cleanTimeSeries: Array<TimeIntervalMetric> = [];
    const responseContent = await response.text();
    const timeSeriesResponse: TimeSeriesResponse = JSON.parse(responseContent);
    if (timeSeriesResponse.timeSeries === undefined) {
      return cleanTimeSeries;
    }

    for (let timeSeries of timeSeriesResponse.timeSeries) {
      for (let point of timeSeries.points) {
        if (point.value.int64Value !== "0") {
          const labels = this.cleanObject(
            timeSeries.metric.labels,
            "__unknown__",
            ""
          );
          const pointMetric: TimeIntervalMetric = {
            ...labels,
            interval: point.interval,
            count: parseInt(point.value.int64Value),
          };

          if (!this.containsObject(pointMetric, cleanTimeSeries)) {
            cleanTimeSeries.push(pointMetric);
          }
        }
      }
    }

    return cleanTimeSeries;
  }

  /**
   * Get Firestore read count metrics.
   * @param {DateTimeStringISO} startTime The beginning of the time interval.
   * @param {DateTimeStringISO} endTime The end of the time interval.
   * @param {string?} accessToken Access token used to authenticate.
   * @returns {Promise<Array<TimeIntervalMetric>>}
   */
  async getReadCount(
    startTime: DateTimeStringISO,
    endTime: DateTimeStringISO,
    accessToken: string | null = null
  ): Promise<Array<TimeIntervalMetric>> {
    if (accessToken === null) {
      await this.generateToken(false);
    }
    const filter = this.metricFilter("document/read_count");
    const res = await this.makeRequest(filter, startTime, endTime);
    const cleanTimeSeries = await this.cleanResponseTimeSeries(res);
    return cleanTimeSeries;
  }

  /**
   * Get Firestore write count metrics.
   * @param {DateTimeStringISO} startTime The beginning of the time interval.
   * @param {DateTimeStringISO} endTime The end of the time interval.
   * @param {string?} accessToken Access token used to authenticate.
   * @returns {Promise<Array<TimeIntervalMetric>>}
   */
  async getWriteCount(
    startTime: DateTimeStringISO,
    endTime: DateTimeStringISO,
    accessToken: string | null = null
  ): Promise<Array<TimeIntervalMetric>> {
    if (accessToken === null) {
      await this.generateToken(false);
    }
    const filter = this.metricFilter("document/write_count");
    const res = await this.makeRequest(filter, startTime, endTime);
    const cleanTimeSeries = await this.cleanResponseTimeSeries(res);
    return cleanTimeSeries;
  }

  /**
   * Get Firestore delete count metrics.
   * @param {DateTimeStringISO} startTime The beginning of the time interval.
   * @param {DateTimeStringISO} endTime The end of the time interval.
   * @param {string?} accessToken Access token used to authenticate.
   * @returns {Promise<Array<TimeIntervalMetric>>}
   */
  async getDeleteCount(
    startTime: DateTimeStringISO,
    endTime: DateTimeStringISO,
    accessToken: string | null = null
  ): Promise<Array<TimeIntervalMetric>> {
    if (accessToken === null) {
      await this.generateToken(false);
    }
    const filter = this.metricFilter("document/delete_count");
    const res = await this.makeRequest(filter, startTime, endTime);
    const cleanTimeSeries = await this.cleanResponseTimeSeries(res);
    return cleanTimeSeries;
  }

  /**
   * Get Firestore snapshot listeners count metrics.
   * @param {DateTimeStringISO} startTime The beginning of the time interval.
   * @param {DateTimeStringISO} endTime The end of the time interval.
   * @param {string?} accessToken Access token used to authenticate.
   * @returns {Promise<Array<TimeIntervalMetric>>}
   */
  async getSnapshotListeners(
    startTime: DateTimeStringISO,
    endTime: DateTimeStringISO,
    accessToken: string | null = null
  ): Promise<Array<TimeIntervalMetric>> {
    if (accessToken === null) {
      await this.generateToken(false);
    }
    const filter = this.metricFilter("network/snapshot_listeners");
    const res = await this.makeRequest(filter, startTime, endTime);
    const cleanTimeSeries = await this.cleanResponseTimeSeries(res);
    return cleanTimeSeries;
  }

  /**
   * Get Firestore active connections count metrics.
   * @param {DateTimeStringISO} startTime The beginning of the time interval.
   * @param {DateTimeStringISO} endTime The end of the time interval.
   * @param {string?} accessToken Access token used to authenticate.
   * @returns {Promise<Array<TimeIntervalMetric>>}
   */
  async getActiveConnections(
    startTime: DateTimeStringISO,
    endTime: DateTimeStringISO,
    accessToken: string | null = null
  ): Promise<Array<TimeIntervalMetric>> {
    if (accessToken === null) {
      await this.generateToken(false);
    }
    const filter = this.metricFilter("network/active_connections");
    const res = await this.makeRequest(filter, startTime, endTime);
    const cleanTimeSeries = await this.cleanResponseTimeSeries(res);
    return cleanTimeSeries;
  }

  /**
   * Get Firestore documents deleted by TTL services count.
   * @param {DateTimeStringISO} startTime The beginning of the time interval.
   * @param {DateTimeStringISO} endTime The end of the time interval.
   * @param {string?} accessToken Access token used to authenticate.
   * @returns {Promise<Array<TimeIntervalMetric>>}
   */
  async getTTLDeletionCount(
    startTime: DateTimeStringISO,
    endTime: DateTimeStringISO,
    accessToken: string | null = null
  ): Promise<Array<TimeIntervalMetric>> {
    if (accessToken === null) {
      await this.generateToken(false);
    }
    const filter = this.metricFilter("document/ttl_deletion_count");
    const res = await this.makeRequest(filter, startTime, endTime);
    const cleanTimeSeries = await this.cleanResponseTimeSeries(res);
    return cleanTimeSeries;
  }

  /**
   * Get Firestore Security Rule evaluations count performed in response to write read requests.
   * @param {DateTimeStringISO} startTime The beginning of the time interval.
   * @param {DateTimeStringISO} endTime The end of the time interval.
   * @param {string?} accessToken Access token used to authenticate.
   * @returns {Promise<Array<TimeIntervalMetric>>}
   */
  async getRulesEvaluationCount(
    startTime: DateTimeStringISO,
    endTime: DateTimeStringISO,
    accessToken: string | null = null
  ): Promise<Array<TimeIntervalMetric>> {
    if (accessToken === null) {
      await this.generateToken(false);
    }
    const filter = this.metricFilter("rules/evaluation_count");
    const res = await this.makeRequest(filter, startTime, endTime);
    const cleanTimeSeries = await this.cleanResponseTimeSeries(res);
    return cleanTimeSeries;
  }

  /**
   * Get Firestore API calls count.
   * @param {DateTimeStringISO} startTime The beginning of the time interval.
   * @param {DateTimeStringISO} endTime The end of the time interval.
   * @param {string?} accessToken Access token used to authenticate.
   * @returns {Promise<Array<TimeIntervalMetric>>}
   */
  async getRequestCount(
    startTime: DateTimeStringISO,
    endTime: DateTimeStringISO,
    accessToken: string | null = null
  ): Promise<Array<TimeIntervalMetric>> {
    if (accessToken === null) {
      await this.generateToken(false);
    }
    const filter = this.metricFilter("api/request_count");
    const res = await this.makeRequest(filter, startTime, endTime);
    const cleanTimeSeries = await this.cleanResponseTimeSeries(res);
    return cleanTimeSeries;
  }
}
