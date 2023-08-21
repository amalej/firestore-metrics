# v1.0.9

- Added way to overwrite access token via `setAccessToken()` method.
- Added way to overwrite access token via `generateToken(true)` method.
  - Set the `overwriteExisting` argument to `true` to overwrite access token.
- Modified output to also include the operation made by the metric
  - Read metrics will now specify whether the `type` was a `QUERY` or `LOOKUP`
  - Write metrics will now specify whether the `op` was a `CREATE` or `UPDATE`
- Added the following methods
  - getRequestCount()
  - getTTLDeletionCount()
  - getRulesEvaluationCount()

# v1.0.8

- Added way to authenticate using `service-account` JSON object.

# v1.0.0

- Initial release
