# Firestore Metrics [![npm](https://img.shields.io/npm/v/firestore-metrics)](https://www.npmjs.com/package/firestore-metrics) [![npm](https://img.shields.io/npm/dt/firestore-metrics)](https://www.npmjs.com/package/firestore-metrics?activeTab=versions)


This is a library which uses the [Cloud Monitoring API v3](https://cloud.google.com/monitoring/api/ref_v3/rest/v3/projects.timeSeries/list) to view Firestore usage metrics.

## Pre-requisites

1. Service account with permission to access the API.
   1. `Viewer` role should suffice.
1. Project must be billing enabled.
   1. This might be more of a bug as requests that use the bearer token obtained from a service account results in a 403 error when the project is not billing enabled.

## How to use

1. Create a service account
1. Download the service account credentials
1. Pass the path to the service account in `FirestoreMetrics`

```js
async function testApi() {
  const firestoreMetrics = new FirestoreMetrics({
    serviceAccountPath: "../service-account.json",
  });
  const readUsage = await firestoreMetrics.getFirestoreReadCount(
    "2023-07-22T08:00:00Z",
    "2023-07-22T22:42:15Z"
  );

  console.log(JSON.stringify(readUsage));
}

testApi();
```

Output would look like:

```json
{
  "status": 200,
  "statusText": "OK",
  "data": [
    {
      "interval": {
        "startTime": "2023-07-22T21:37:00Z",
        "endTime": "2023-07-22T21:38:00Z"
      },
      "count": "48"
    },
    {
      "interval": {
        "startTime": "2023-07-22T21:36:00Z",
        "endTime": "2023-07-22T21:37:00Z"
      },
      "count": "25"
    },
    {
      "interval": {
        "startTime": "2023-07-22T20:47:00Z",
        "endTime": "2023-07-22T20:48:00Z"
      },
      "count": "28"
    },
    {
      "interval": {
        "startTime": "2023-07-22T08:15:00Z",
        "endTime": "2023-07-22T08:16:00Z"
      },
      "count": "14"
    }
  ]
}
```
