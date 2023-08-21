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

interface FirestoreMetricsArgs<T extends AuthClient = JSONClient> {
  /**
   * Your project id.
   */
  projectId?: string;
  /**
   * An `AuthClient` to use
   */
  authClient?: T;
  /**
   * Path to a .json, .pem, or .p12 key file
   */
  keyFilename?: string;
  /**
   * Path to a .json, .pem, or .p12 key file
   */
  keyFile?: string;
  /**
   * Object containing client_email and private_key properties, or the
   * external account client options.
   */
  credentials?: CredentialBody | ExternalAccountClientOptions;
  /**
   * Options object passed to the constructor of the client
   */
  clientOptions?:
    | JWTOptions
    | OAuth2ClientOptions
    | UserRefreshClientOptions
    | ImpersonatedOptions;
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
    [key: string]: string;
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
  operation?: string;
  interval: Interval;
  count: number;
}

export type DateTimeStringISO =
  `${number}-${number}-${number}T${number}:${number}:${number}Z`;

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

  constructor({
    projectId,
    keyFilename,
    keyFile,
    credentials,
  }: FirestoreMetricsArgs) {
    this.googleAuthArgs = {
      keyFilename,
      keyFile,
      credentials,
    };
    this.projectId = projectId;
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
          const pointMetric: TimeIntervalMetric = {
            operation:
              timeSeries.metric.labels.type || timeSeries.metric.labels.op,
            interval: point.interval,
            count: parseInt(point.value.int64Value),
          };
          cleanTimeSeries.push(pointMetric);
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
  async getFirestoreReadCount(
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
  async getFirestoreWriteCount(
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
  async getFirestoreDeleteCount(
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
  async getFirestoreSnapshotListeners(
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
  async getFirestoreActiveConnections(
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
}
