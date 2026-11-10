# Retained dashboard walkthrough evidence

This compact walkthrough was captured on 2026-11-08 against:

- Serving release: `ncrb-districtwise-2021-2024-ecec48b772bc`
- Analysis run: `ncrb-national-2024-admin-log1p-zscore-20261107-v4`
- Result: 44/44 automated checks passed; no console or page errors. See [`summary.json`](summary.json).

| Step | Route | Screenshot | Text capture |
|---|---|---|---|
| Overview | `/` | [`step1.png`](step1.png) | [`step1_text.txt`](step1_text.txt) |
| Regional comparison | `/compare` | [`step2.png`](step2.png) | [`step2_text.txt`](step2_text.txt) |
| Trends, including matched cohort | `/trends` | [`step3.png`](step3.png) | [`step3_text.txt`](step3_text.txt), [`step3_annual_text.txt`](step3_annual_text.txt) |
| Data quality | `/quality` | [`step4.png`](step4.png) | [`step4_text.txt`](step4_text.txt) |
| PCA | `/pca` | [`step5.png`](step5.png) | [`step5_text.txt`](step5_text.txt) |
| Clusters | `/clusters` | [`step6.png`](step6.png) | [`step6_text.txt`](step6_text.txt) |
| Anomalies | `/anomalies` | [`step7.png`](step7.png) | [`step7_text.txt`](step7_text.txt) |
| Association rules | `/rules` | [`step8.png`](step8.png) | [`step8_text.txt`](step8_text.txt) |
| Methodology | `/methodology` | [`step9.png`](step9.png) | [`step9_text.txt`](step9_text.txt) |

These are historical screenshots of the current UI at capture time. For the cleanup's fresh live smoke, run `npm run test:e2e` with both services started; that command writes a new timestamped result directory.
