# Publication Transaction Contract

1. A pull request validates readiness but cannot create a tag or release.
2. The owner reviews and merges the prepared release commit.
3. The release ritual provisions stable Android secrets and tags the reviewed merge commit `v0.1.0`.
4. Automation accepts only `shruggietech/glitchpad` and `v0.1.0`, then waits for every package gate.
5. Automation rejects incomplete or undeclared assets and an existing release before creation.
6. Only then may it create one release and upload governed assets and evidence.
