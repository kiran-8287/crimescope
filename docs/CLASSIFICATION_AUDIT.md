# CrimeScope — Reporting-Unit Classification Audit

**Date:** 2026-11-06  
**Status:** Audited and Verified

---

## 1. Classification Framework

In the NCRB district-wise crime publications, rows represent reporting jurisdictions rather than uniform revenue/administrative districts. There are four primary administrative and jurisdictional types present in the source files:

1. **`administrative_district`**: A standard revenue district administered by a District Magistrate / Collector, where the district police boundary coincides with the revenue district boundary.
2. **`city_police`**: Police commissionerates and urban commissionerate jurisdictions (e.g., Mumbai Police Commissionerate, Delhi Police Commissionerate districts, Bengaluru City, Hyderabad City, Kolkata Police, Kochi/Ernakulam Commr). In many states, commissionerates carve out the urban core of an administrative district.
3. **`railway`**: Government Railway Police (GRP) or Superintendent of Railway Police (SRP) units whose jurisdiction runs along railway tracks and stations across multiple districts.
4. **`other_police_unit`**: Specialized, rural, or range jurisdictions. This includes:
   - *Rural police districts*: When a revenue district is partitioned between an urban commissionerate and a rural police district (e.g., Ahmedabad City vs. Ahmedabad Rural; Pune City vs. Pune Rural; Nagpur City vs. Nagpur Rural).
   - *Specialized task forces & units*: Anti-Terrorist Squad, Cyber Crime Ranges, Crime Branch, CID, Economic Offences Wing (EOW), Special Cell, Vigilance.
   - *Police districts*: West Bengal police districts like Baruipur, Diamond Harbour, Sundarban that partition revenue districts (e.g., South 24 Parganas).
5. **`unclassified`**: Any reporting unit whose constitutional administrative status cannot be verified from available source gazettes.

---

## 2. Audit of the Fallback Classification Rule

The previous classification rule in `analysis/src/crimescope_analysis/cleaning/canonical.py`:
```python
def classify_region(name: str) -> str:
    lower = name.lower().strip()
    if lower in TOTAL_TOKENS or lower == "":
        return "aggregate"
    if "railway" in lower:
        return "railway"
    if any(token in lower for token in ("city", "urban", "commissionerate", "metro")):
        return "city_police"
    if any(token in lower for token in ("crime branch", "cyber crime", "cid", "special task force", "task force", "economic offences", "anti narcotic", "crime wing", "crime and eou", "igi airport", "airport")):
        return "other_police_unit"
    return "administrative_district"
```

### Critical Flaws Identified:
1. **Commissionerate Spelling Variants:** Commissionerates spelled `Commr`, `Commr.`, `Commissionarate`, `DCP`, or prefixed `CP` defaulted to `administrative_district`.
2. **Railway Police Units:** Abbreviations like `GRP` (Government Railway Police) and `SRP` (Superintendent of Railway Police) did not contain the substring `"railway"` and defaulted to `administrative_district`.
3. **Rural Police Divisions:** Revenue districts partitioned into Urban Commissionerates and Rural police districts (e.g., `Ahmedabad Rural`, `Pune Rural`, `Ludhiana Rural`) defaulted to `administrative_district`.
4. **Specialized Police Units:** Abbreviations and terms like `EOW`, `Spl Cell`, `Vigilance`, `Cyber * Range`, `Anti Terrorist Squad`, `STF`, `RPO`, `SOU`, `Bureau of Investigation`, `SSB` defaulted to `administrative_district`.
5. **Unconditional Default:** Any unrecognised reporting unit automatically defaulted to `administrative_district` instead of remaining `unclassified`.

---

## 3. Classification Audit Register

The table below documents units that were previously classified as `administrative_district` and their verified classification:

| State / UT | Region Name | Previous Classification | Verified Classification | Evidence / Source Context | Affected Years |
|---|---|---|---|---|---|
| **Odisha** | `DCP CTC` | `administrative_district` | `city_police` | Deputy Commissioner of Police, Cuttack Urban Police | 2021–2024 |
| **Odisha** | `DCP BBSR` | `administrative_district` | `city_police` | Deputy Commissioner of Police, Bhubaneswar Urban Police | 2021–2024 |
| **Odisha** | `SRP(Cuttack)` | `administrative_district` | `railway` | Superintendent of Railway Police, Cuttack Railway Jurisdiction | 2021–2024 |
| **Odisha** | `SRP(Rourkela)` | `administrative_district` | `railway` | Superintendent of Railway Police, Rourkela Railway Jurisdiction | 2021–2024 |
| **Assam, HR, HP, PB, TR, UP, UK** | `GRP` | `administrative_district` | `railway` | Government Railway Police state unit | 2021–2024 |
| **Chhattisgarh** | `GRP Raipur` | `administrative_district` | `railway` | Government Railway Police, Raipur Division | 2021–2024 |
| **West Bengal** | `Howrah GRP`, `Kharagpur GRP`, `Sealdah GRP`, `Siliguri GRP` | `administrative_district` | `railway` | Railway police superintendent jurisdictions | 2021–2024 |
| **Rajasthan** | `GRP Ajmer`, `GRP Jodhpur` | `administrative_district` | `railway` | Government Railway Police district units | 2021–2024 |
| **Kerala** | `Ernakulam Commr`, `Kollam Commr`, `Kozhikode Commr`, `Thrissur Commr`, `Trivandrum Commr` | `administrative_district` | `city_police` | City Police Commissionerates | 2021–2024 |
| **Madhya Pradesh** | `Bhopal Commissionarate`, `Indore Commissionarate` | `administrative_district` | `city_police` | Urban Police Commissionerates established Dec 2021 | 2022–2024 |
| **Uttar Pradesh** | `Kanpur Commissionarate`, `Lucknow Commissionarate`, `Varanasi Commissionarate` | `administrative_district` | `city_police` | Metropolitan Police Commissionerates | 2021–2024 |
| **Maharashtra** | `Amravati Commr`, `Chhatrapati Sambhajinagar Commr`, `Mira Bhayandar Vasai Virar Commr`, `Mumbai Commr`, `Nagpur Commr`, `Nasik Commr`, `Pimpri Chinchwad Commr`, `Pune Commr`, `Solapur Commr`, `Thane Commr` | `administrative_district` | `city_police` | Police Commissionerates under Maharashtra Police Act | 2021–2024 |
| **Punjab** | `CP Amritsar`, `CP Jalandhar`, `CP Ludhiana` | `administrative_district` | `city_police` | Commissioner of Police jurisdictions | 2021–2024 |
| **Bihar** | `Anti Terrorist Squad` | `administrative_district` | `other_police_unit` | Specialized state anti-terror investigation unit | 2021–2024 |
| **Gujarat** | `Cyber Ahmedabad Range`, `Cyber Bhavnagar Range`, `Cyber Border Range`, `Cyber Gandhinagar Range`, `Cyber Junagadh Range`, `Cyber Panchmahal Range`, `Cyber Rajkot Range`, `Cyber Surat Range`, `Cyber Vadodara Range` | `administrative_district` | `other_police_unit` | Zonal Cyber Police Ranges across police commissionerates | 2021–2024 |
| **Delhi** | `EOW`, `Spl Cell`, `Vigilance` | `administrative_district` | `other_police_unit` | Specialized Delhi Police headquarters departments | 2021–2024 |
| **Punjab** | `Bureau of Investigation` | `administrative_district` | `other_police_unit` | Specialized investigative wing of Punjab Police | 2021–2024 |
| **Assam** | `RPO`, `SOU`, `STF` | `administrative_district` | `other_police_unit` | River Police, Special Operation Unit, Special Task Force | 2021–2024 |
| **Meghalaya, TN, UK, MZ, HP** | `Cyber Cell` / `Cyber` / `Cyber Security` | `administrative_district` | `other_police_unit` | Specialized cyber crime police stations | 2021–2024 |
| **Gujarat** | `Ahmedabad Rural`, `Rajkot Rural`, `Surat Rural`, `Vadodara Rural` | `administrative_district` | `other_police_unit` | Rural police district surrounding urban commissionerate | 2021–2024 |
| **Kerala** | `Ernakulam Rural`, `Kannur Rural`, `Kollam Rural`, `Kozhikode Rural`, `Thrissur Rural`, `Trivandrum Rural` | `administrative_district` | `other_police_unit` | Rural police jurisdiction outside city commissionerate | 2021–2024 |
| **Madhya Pradesh** | `Bhopal Rural`, `Indore Rural` | `administrative_district` | `other_police_unit` | Rural police district outside commissionerate | 2022–2024 |
| **Maharashtra** | `Amravati Rural`, `Nagpur Rural`, `Nasik Rural`, `Pune Rural`, `Solapur Rural`, `Thane Rural`, `Chhatrapati Sambhajinagar Rural` | `administrative_district` | `other_police_unit` | District police jurisdiction outside municipal commissionerate | 2021–2024 |
| **Punjab** | `Amritsar Rural`, `Jalandhar Rural`, `Ludhiana Rural` | `administrative_district` | `other_police_unit` | Rural police district | 2021–2024 |
| **Rajasthan** | `Jaipur Rural`, `Jodhpur Rural`, `Kota Rural` | `administrative_district` | `other_police_unit` | Rural police district | 2021–2024 |
| **West Bengal** | `Baruipur Police`, `Diamond Harbour Police`, `Hooghly Rural Police`, `Howrah Rural`, `Jangipur Police District`, `Murshidabad Police District`, `Sundarban Police` | `administrative_district` | `other_police_unit` | Police district units established under West Bengal Police Act | 2021–2024 |
| **Arunachal Pradesh** | `Papum Pare Rural` | `administrative_district` | `other_police_unit` | Police district distinct from Capital Complex Itanagar | 2021–2024 |
| **Andhra Pradesh** | `Visakha Rural` | `administrative_district` | `other_police_unit` | Rural police jurisdiction pre-2022 reorganization | 2020–2021 |

---

## 4. UI Terminology & Contract Harmonization

To align the user interface, API contracts, and model manifests with geographic and administrative reality:

1. **Global Labeling:** All filter dropdowns and cohort descriptions use the term **"Reporting units"** by default rather than claiming all units are "Administrative districts".
2. **Distinct Unit Type Filters:**
   - All reporting units
   - Administrative districts (revenue districts)
   - City-police / Commissionerates
   - Railway police units
   - Other specialized police units
3. **Cohort Membership Safeguard:**
   - Comparisons and model cohorts explicitly display the reporting-unit types included.
   - Any unit lacking supported revenue-district boundaries is not merged into administrative district sums.

