import { GoogleAuth } from "google-auth-library";
import { JSONClient } from "google-auth-library/build/src/auth/googleauth";

interface TimeSeriesResponse {
  timeSeries: Array<TimeSeries>;
}

interface TimeSeries {
  metric: Metric;
  points: Array<Point>;
}

interface Metric {
  labels: {
    type: MetricType;
  };
}

interface Point {
  interval: Interval;
  value: {
    int64Value: string;
  };
}

interface Interval {
  startTime: string;
  endTime: string;
}

interface TimeIntervalMetric {
  interval: Interval;
  count: string;
}

interface ProjectConfigs {
  serviceAccountPath: string;
  projectId?: string | null;
}

export interface FirestoreMonitoringResponse {
  status: number;
  statusText: string;
  data: Array<TimeIntervalMetric>;
}

type MetricType = "QUERY" | "LOOK_UP" | string;

export type DateTimeStringISO =
  `${number}-${number}-${number}T${number}:${number}:${number}Z`;

export class FirestoreMonitoring {
  serviceAccountPath: string;
  projectId: string;
  accessToken: string | null = null;
  private googleAuth: GoogleAuth<JSONClient>;
  private baseUrl = "https://monitoring.googleapis.com/v3/projects";
  private scopes: Array<string> = [
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/monitoring",
    "https://www.googleapis.com/auth/monitoring.read",
  ];

  constructor({ serviceAccountPath, projectId = null }: ProjectConfigs) {
    this.serviceAccountPath = serviceAccountPath;
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
   * Gets the project ID if is it still null.
   */
  async getProjectId(): Promise<string> {
    this.projectId = this.projectId || (await this.googleAuth.getProjectId());
    return this.projectId;
  }

  /**
   * Generates an access token.
   * @returns {Promise<string>} Access token used to authenticate requests.
   */
  async generateToken(): Promise<string> {
    this.googleAuth = new GoogleAuth({
      keyFile: this.serviceAccountPath,
      scopes: this.scopes,
    });

    await this.getProjectId();
    this.accessToken =
      this.accessToken || (await this.googleAuth.getAccessToken());
    return this.accessToken;
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
    const startTimes: Array<string> = [];
    const responseContent = await response.text();
    const timeSeriesResponse: TimeSeriesResponse = JSON.parse(responseContent);
    if (timeSeriesResponse.timeSeries === undefined) {
      return cleanTimeSeries;
    }

    for (let timeSeries of timeSeriesResponse.timeSeries) {
      for (let point of timeSeries.points) {
        if (point.value.int64Value !== "0") {
          if (startTimes.includes(point.interval.startTime)) {
            continue;
          }
          const pointMetric: TimeIntervalMetric = {
            interval: point.interval,
            count: point.value.int64Value,
          };
          startTimes.push(pointMetric.interval.startTime);
          cleanTimeSeries.push(pointMetric);
        }
      }
    }

    return cleanTimeSeries;
  }

  /**
   *
   * @param {string} startTime The beginning of the time interval.
   * @param {string} endTime The end of the time interval.
   * @param {string?} accessToken Access token used to authenticate.
   * @returns {Promise<FirestoreMonitoringResponse>}
   */
  async getFirestoreReadCount(
    startTime: DateTimeStringISO,
    endTime: DateTimeStringISO,
    accessToken: string | null = null
  ): Promise<FirestoreMonitoringResponse> {
    if (accessToken === null) {
      await this.generateToken();
    }
    const filter = this.metricFilter("document/read_count");
    const res = await this.makeRequest(filter, startTime, endTime);
    const cleanTimeSeries = await this.cleanResponseTimeSeries(res);
    return {
      status: res.status,
      statusText: res.statusText,
      data: cleanTimeSeries,
    };
  }

  /**
   *
   * @param {string} startTime The beginning of the time interval.
   * @param {string} endTime The end of the time interval.
   * @param {string?} accessToken Access token used to authenticate.
   * @returns {Promise<FirestoreMonitoringResponse>}
   */
  async getFirestoreWriteCount(
    startTime: DateTimeStringISO,
    endTime: DateTimeStringISO,
    accessToken: string | null = null
  ) {
    if (accessToken === null) {
      await this.generateToken();
    }
    const filter = this.metricFilter("document/write_count");
    const res = await this.makeRequest(filter, startTime, endTime);
    const cleanTimeSeries = await this.cleanResponseTimeSeries(res);
    return {
      status: res.status,
      statusText: res.statusText,
      data: cleanTimeSeries,
    };
  }

  /**
   *
   * @param {string} startTime The beginning of the time interval.
   * @param {string} endTime The end of the time interval.
   * @param {string?} accessToken Access token used to authenticate.
   * @returns {Promise<FirestoreMonitoringResponse>}
   */
  async getFirestoreDeleteCount(
    startTime: DateTimeStringISO,
    endTime: DateTimeStringISO,
    accessToken: string | null = null
  ) {
    if (accessToken === null) {
      await this.generateToken();
    }
    const filter = this.metricFilter("document/delete_count");
    const res = await this.makeRequest(filter, startTime, endTime);
    const cleanTimeSeries = await this.cleanResponseTimeSeries(res);
    return {
      status: res.status,
      statusText: res.statusText,
      data: cleanTimeSeries,
    };
  }

  /**
   *
   * @param {string} startTime The beginning of the time interval.
   * @param {string} endTime The end of the time interval.
   * @param {string?} accessToken Access token used to authenticate.
   * @returns {Promise<FirestoreMonitoringResponse>}
   */
  async getFirestoreSnapshotListeners(
    startTime: DateTimeStringISO,
    endTime: DateTimeStringISO,
    accessToken: string | null = null
  ) {
    if (accessToken === null) {
      await this.generateToken();
    }
    const filter = this.metricFilter("network/snapshot_listeners");
    const res = await this.makeRequest(filter, startTime, endTime);
    const cleanTimeSeries = await this.cleanResponseTimeSeries(res);
    return {
      status: res.status,
      statusText: res.statusText,
      data: cleanTimeSeries,
    };
  }

  /**
   *
   * @param {string} startTime The beginning of the time interval.
   * @param {string} endTime The end of the time interval.
   * @param {string?} accessToken Access token used to authenticate.
   * @returns {Promise<FirestoreMonitoringResponse>}
   */
  async getFirestoreActiveConnections(
    startTime: DateTimeStringISO,
    endTime: DateTimeStringISO,
    accessToken: string | null = null
  ) {
    if (accessToken === null) {
      await this.generateToken();
    }
    const filter = this.metricFilter("network/active_connections");
    const res = await this.makeRequest(filter, startTime, endTime);
    const cleanTimeSeries = await this.cleanResponseTimeSeries(res);
    return {
      status: res.status,
      statusText: res.statusText,
      data: cleanTimeSeries,
    };
  }
}
