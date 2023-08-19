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

```js
import { FirestoreMetrics } from "firestore-metrics";

async function testApi() {
  const firestoreMetrics = new FirestoreMetrics({
    serviceAccountPath: "./service-account.json",
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
[
  {
    "interval": {
      "startTime": "2023-07-22T21:37:00Z",
      "endTime": "2023-07-22T21:38:00Z"
    },
    "count": 48
  },
  {
    "interval": {
      "startTime": "2023-07-22T21:36:00Z",
      "endTime": "2023-07-22T21:37:00Z"
    },
    "count": 25
  },
  {
    "interval": {
      "startTime": "2023-07-22T20:48:00Z",
      "endTime": "2023-07-22T20:49:00Z"
    },
    "count": 7
  },
  {
    "interval": {
      "startTime": "2023-07-22T20:47:00Z",
      "endTime": "2023-07-22T20:48:00Z"
    },
    "count": 28
  },
  {
    "interval": {
      "startTime": "2023-07-22T16:04:00Z",
      "endTime": "2023-07-22T16:05:00Z"
    },
    "count": 3
  },
  {
    "interval": {
      "startTime": "2023-07-22T16:03:00Z",
      "endTime": "2023-07-22T16:04:00Z"
    },
    "count": 11
  },
  {
    "interval": {
      "startTime": "2023-07-22T08:15:00Z",
      "endTime": "2023-07-22T08:16:00Z"
    },
    "count": 14
  }
]
```

## Ways to authenticate request

### Using a service-account file

Just provide the path to your `service-account` file

```js
const firestoreMetrics = new FirestoreMetrics({
  serviceAccountPath: "./service-account.json",
});
```

### Using service-account credentials

Just provide the JSON object of your `service-account` credentials

```js
const firestoreMetrics = new FirestoreMetrics({
  credentials: {
    type: "service_account",
    project_id: "<PROJECT_ID>",
    private_key_id: "<PRIVATE_KEY_ID>",
    private_key: "<PRIVATE_KEY>",
    client_email: "<CLIENT_EMAIL>",
    client_id: "<CLIENT_ID>",
    auth_uri: "<AUTH_URI>",
    token_uri: "<TOKEN_URI>",
    auth_provider_x509_cert_url: "<AUTH_PROVIDER_X509_CERT_URL>",
    client_x509_cert_url: "<CLIENT_X509_CERT_URL>",
    universe_domain: "<UNIVERSE_DOMAIN>",
  },
});
```
