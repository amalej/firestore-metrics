import { FirestoreMetrics } from "../src/index";
import { existsSync } from "fs";

describe("testing index file", () => {
  const pathToServiceAccount = process.env.npm_config_pathSA;
  if (typeof pathToServiceAccount !== "string") {
    console.error(
      "No service account path provided. Run `npm run test --pathSA=<path_to_service_account>"
    );
    return;
  }

  if (!existsSync(pathToServiceAccount)) {
    console.error(
      "Invalid service account path provided. Provide a valid path."
    );
    return;
  }

  const firestoreMetrics = new FirestoreMetrics({
    serviceAccountPath: pathToServiceAccount,
  });

  beforeAll(async () => {
    const token = await firestoreMetrics.generateToken();
    console.log(`\x1b[30m\x1b[42m Bearer Token \x1b[0m ${token}`);
  });

  test("Read Firestore count must return a 200 response.", async () => {
    const readCountData = await firestoreMetrics.getFirestoreReadCount(
      "2023-07-22T08:00:00Z",
      "2023-07-22T22:42:15Z"
    );
    // API will respond with 403 when billing is not enabled on the project.
    if (readCountData.status === 403) {
      console.log(readCountData.status, readCountData.statusText);
    }
    expect(readCountData.status).toBe(200);
  });

  test("Write Firestore count must return a 200 response.", async () => {
    const writeCountData = await firestoreMetrics.getFirestoreWriteCount(
      "2023-07-22T08:00:00Z",
      "2023-07-22T22:42:15Z"
    );
    // API will respond with 403 when billing is not enabled on the project.
    expect(writeCountData.status).toBe(200);
  });

  test("Delete Firestore count must return a 200 response.", async () => {
    const deleteCountData = await firestoreMetrics.getFirestoreDeleteCount(
      "2023-07-22T08:00:00Z",
      "2023-07-22T22:42:15Z"
    );
    // API will respond with 403 when billing is not enabled on the project.
    expect(deleteCountData.status).toBe(200);
  });

  test("Active connections count must return a 200 response.", async () => {
    const activeConnectionsCountData = await firestoreMetrics.getFirestoreActiveConnections(
      "2023-07-22T08:00:00Z",
      "2023-07-22T22:42:15Z"
    );
    // API will respond with 403 when billing is not enabled on the project.
    expect(activeConnectionsCountData.status).toBe(200);
  });

  test("Snapshot listener count must return a 200 response.", async () => {
    const snapshotListenerCountData = await firestoreMetrics.getFirestoreSnapshotListeners(
      "2023-07-22T08:00:00Z",
      "2023-07-22T22:42:15Z"
    );
    // API will respond with 403 when billing is not enabled on the project.
    expect(snapshotListenerCountData.status).toBe(200);
  });
});
