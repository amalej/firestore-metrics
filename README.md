# Firestore Metrics [![npm](https://img.shields.io/npm/v/firestore-metrics)](https://www.npmjs.com/package/firestore-metrics) [![npm](https://img.shields.io/npm/dt/firestore-metrics)](https://www.npmjs.com/package/firestore-metrics?activeTab=versions)

This is a library which uses the [Cloud Monitoring API v3](https://cloud.google.com/monitoring/api/ref_v3/rest/v3/projects.timeSeries/list) to view Firestore usage metrics.

## Pre-requisites

1. A service account with permission to access the API.
   1. `Viewer` role should suffice.
1. Project must be billing enabled.
   1. This might be more of a bug as requests that use the bearer token obtained from a service account results in a 403 error when the project is not billing enabled.

## How to use

1. Create a service account.
   1. Follow steps here to [create a service account](https://cloud.google.com/iam/docs/service-accounts-create#creating).
   1. Select the `Console` tab.
   1. When selecting a role, under `Quick access` > `Basic`, pick `Viewer`.
1. Download the service account keys.
   1. Follow the steps here to [download the service account key](https://cloud.google.com/iam/docs/keys-create-delete#creating).
1. Pass the service-account key file path or service-account credentials to `FirestoreMetrics`

## Method references

<div>
  Usage metrics
  <ul>
    <li>getRequestCount() - Get Firestore API calls count</li>
    <li>getReadCount() - Get Firestore read count metrics</li>
    <li>getWriteCount() - Get Firestore write count metrics</li>
    <li>getDeleteCount() - Get Firestore delete count metrics</li>
    <li>getSnapshotListeners() - Get Firestore snapshot listeners count metrics</li>
    <li>getActiveConnections() - Get Firestore active connections count metrics</li>
    <li>getTTLDeletionCount() - Get Firestore documents deleted by TTL services count</li>
    <li>getRulesEvaluationCount() - Get Firestore Security Rule evaluations count performed in response to write read requests</li>
  </ul>
</div>

<div>
  Misc.
  <ul>
    <li>getProjectId() - Gets the project ID and sets its value if it is still null</li>
    <li>generateToken() - Generate an access token to be used to authenticate requests</li>
    <li>setAccessToken() - Overwrites the access token used to authenticate requests</li>
  </ul>
</div>

### Get read metrics

```js
import { FirestoreMetrics } from "firestore-metrics";

async function testApi() {
  const firestoreMetrics = new FirestoreMetrics({
    projectId: "PROJECT_ID",
    keyFile: "./service-account.json",
  });
  const readUsage = await firestoreMetrics.getReadCount(
    "2023-07-22T08:00:00Z",
    "2023-07-22T22:42:15Z"
  );

  console.log(JSON.stringify(readUsage, null, 4));
}

testApi();
```

Output would look like:

```json
[
  {
    "type": "QUERY",
    "interval": {
      "startTime": "2023-08-21T16:15:00Z",
      "endTime": "2023-08-21T16:16:00Z"
    },
    "count": 26
  },
  {
    "type": "QUERY",
    "interval": {
      "startTime": "2023-08-21T16:14:00Z",
      "endTime": "2023-08-21T16:15:00Z"
    },
    "count": 15
  },
  {
    "type": "QUERY",
    "interval": {
      "startTime": "2023-08-21T15:51:00Z",
      "endTime": "2023-08-21T15:52:00Z"
    },
    "count": 11
  }
]
```

### Get write metrics

```js
import { FirestoreMetrics } from "firestore-metrics";

async function testApi() {
  const firestoreMetrics = new FirestoreMetrics({
    projectId: "PROJECT_ID",
    keyFile: "./service-account.json",
  });
  const writeUsage = await firestoreMetrics.getWriteCount(
    "2023-08-21T15:00:00Z",
    "2023-08-21T20:00:00Z"
  );

  console.log(JSON.stringify(writeUsage, null, 4));
}

testApi();
```

Output would look like:

```json
[
  {
    "op": "CREATE",
    "interval": {
      "startTime": "2023-08-21T16:09:00Z",
      "endTime": "2023-08-21T16:10:00Z"
    },
    "count": 1
  },
  {
    "op": "UPDATE",
    "interval": {
      "startTime": "2023-08-21T16:15:00Z",
      "endTime": "2023-08-21T16:16:00Z"
    },
    "count": 1
  },
  {
    "op": "UPDATE",
    "interval": {
      "startTime": "2023-08-21T16:09:00Z",
      "endTime": "2023-08-21T16:10:00Z"
    },
    "count": 1
  }
]
```

## Ways to authenticate request

### Using a service-account file

Just provide the path to your `service-account` file

```js
const firestoreMetrics = new FirestoreMetrics({
  projectId: "PROJECT_ID",
  keyFile: "./service-account.json",
});
```
