# S045 reference startup gate decision

## Approved owner amendment (2026-11-03)

S021 SC-006 previously required reference-profile startup under the 2500 ms desktop hard limit before official publication. Hosted smoke cannot prove that hardware-specific criterion. S044/S045 retain the 1500/2500 ms reference classifications, 10000 ms hosted-smoke ceiling and remaining #239 work, and needed an explicit amendment to retire the older publication prerequisite. No reference setup is available.

Approved owner decision: retire the unavailable reference-hardware prerequisite for this community release; require the existing automated hosted platform/packaged lifecycle evidence and unchanged 10000 ms hosted startup ceiling. Continue reporting the 1500/2500 ms classifications and retain #239 without claiming a reference-hardware pass. This changes release eligibility, not the numeric thresholds or measured outcomes. The Linux official validator gates its declared hosted_smoke evidence against 10000 ms, with a regression accepting a truthful 2600 ms reference failure and rejecting10001 ms.

Owner reply: "Retire the reference-hardware gate; use the existing hosted checks (recommended)". This supersedes the legacy S021 FR-020/SC-006 reference-hardware prerequisite for v0.2.0. Publication still requires complete actual automated qualification, review dispositions and public readback; no physical/reference measurement is claimed.
