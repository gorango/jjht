# EUREKA — portfolio

5 collaborations proposed from 12 company challenges, after 7 critic rejections.

## 1. ArmaturaSec d.o.o. × Krisztina Kiss

- **Challenge:** C001-CH1
- **Fit:** 95%
- **Why:** Directly applies unsupervised anomaly detection to Modbus traffic in ICS, matching the core need to learn a normal baseline without attack data.
- **Proposal:** `P-C001-CH1-R1008`

**Company: ArmaturaSec d.o.o. (C001)** | **Researcher: Prof. Krisztina Kiss (R1008)**

## 1. The Concrete Problem
ArmaturaSec’s ProtoSense module passively monitors Modbus TCP and BACnet/IP traffic but lacks the ability to detect novel attacks. No operational client has ever provided a packet capture with a confirmed breach, making supervised classifiers trained on public datasets useless due to excessive false positives in live deployments (C001-CH1). A solution is required that learns a site-specific model of normal behaviour from terabytes of unlabelled traffic archives and raises alarms only when a statistically significant deviation occurs, with explanations a plant manager can understand.

## 2. First-Year Work Plan
**Months 1–3 (Design & Baseline):**
- **ArmaturaSec** will provide security-cleared access to two representative, anonymised Modbus/TCP and BACnet/IP traffic archives and protocol parser output (C001, C001-CH1). Their engineer will document the current ProtoSense feature extraction pipeline.
- **Prof. Kiss’s group** will instrument the data to extract time-windowed statistical features, applying methods from SYN-PUB-10472 and SYN-PUB-10474 to characterise normal traffic cycles.
- Both parties will jointly define evaluation criteria: detection sensitivity, false-positive rate per day, and explainability requirements.

**Months 4–9 (Model Development & Testbed Validation):**
- **Prof. Kiss’s group** will adapt one-class classification techniques, specifically Isolation Forest and One-Class SVM approaches validated in SYN-PUB-10473 and SYN-PUB-10475, to the provided datasets. Hyperparameter tuning will target a tolerable false-positive rate under zero-attack-data conditions.
- **ArmaturaSec** will translate the resulting model into a resource-constrained C implementation suitable for the NetGuard-OT Mini hardware bench (C001).
- **Prof. Kiss’s group** will inject synthetic, unlabeled attacks into a replica setup on their ICS testbed (R1008) to stress-test the model without using the attack signatures during training.

**Months 10–12 (Integration & Field Trial Preparation):**
- **ArmaturaSec** will integrate the detector into a ProtoSense firmware release candidate. **Prof. Kiss** will consult on calibration for one volunteer client site.
- Joint documentation of the final method, failure modes, and a plain-language explanation guide for plant managers.

## 3. What Each Side Brings
- **ArmaturaSec (C001)** contributes multi-terabyte traffic archives, the on-device execution environment (NetGuard-OT Mini), firmware engineering to port the model, and the deployment channel to clients.
- **Prof. Krisztina Kiss (R1008)** contributes proven methods for statistical baseline modelling of Modbus/TCP (SYN-PUB-10472), one-class intrusion detection on ICS protocols (SYN-PUB-10473, SYN-PUB-10475), a dedicated ICS testbed for controlled experiments, and experience collaborating with operational infrastructure partners.

## 4. What Would Make It Fail
- **Protocol Mismatch:** The BACnet/IP traffic exhibits behavioural dynamics fundamentally different from Modbus, and the one-class methods do not transfer without a full redesign.
- **Uncontrolled Drift:** The unsupervised model adapts too slowly to legitimate operational changes (e.g., a plant reconfiguration) and produces a flood of false alarms that operators ignore, mirroring past failures (C001-CH1).
- **Explainability Gap:** The statistical anomalies cannot be translated into plain-language "what happened and what to do" messages, preventing acceptance by plant managers.
- **Embedded Feasibility:** The final model, even after optimisation, exceeds the memory or latency budget of the NetGuard-OT Mini firmware, making on-device inference impossible.

---

## 2. Zrenjanin Game Works d.o.o. × Danilo Mitrović

- **Challenge:** C002-CH1
- **Fit:** 95%
- **Why:** Directly specializes in using clickstream data for competency prediction with sequence mining and HMMs, a perfect match for detecting guessing patterns.
- **Proposal:** `P-C002-CH1-R1006`

**Problem: Guessing masquerades as learning in game-based math practice.**
Teachers using Zrenjanin Game Works' math titles for grades 1–4 report students who maintain high scores through rapid, patternless clicking. These students fail paper-based assessments, eroding teacher trust in the software's summative value. The company possesses rich clickstream logs for 4,200 students (2022–23, 2023–24 school years) containing timestamps, question IDs, chosen answers, duration, and attempt counts (C002-CH1). Currently, the data is used only for simple accuracy thresholds, which fail to distinguish a student mastering single-digit addition from one clicking briskly until feedback appears. The company needs a validated, explainable method—not a black-box platform—to flag likely guessers before the 2025–26 school year.

**Proposed First-Year collaboration.**
Assistant Professor Danilo Mitrović's group and Zrenjanin Game Works will co-develop a lightweight classifier that labels individual student–session sequences as *engaged learning*, *mixed pattern*, or *likely disengaged guessing*. The work proceeds in three phases:

1. **Feature engineering from raw clickstreams (Months 1–3).** Mitrović's team will extract temporal and sequential features from the exported CSV logs—inter-response interval distributions, response entropy, streak lengths of correct answers under abnormally low latency, and transitional patterns between question types (SYN-PUB-10456). Zrenjanin staff (Miroslav Kovačević, one day/week) will provide domain rules about game mechanics, difficulty scaling, and known on-screen feedback delays so that features are pedagogically grounded.

2. **Model prototyping and teacher-sense validation (Months 4–8).** The research group will fit a hidden Markov model with interpretable latent states corresponding to "thoughtful solving," "hinted attempt," and "rapid guessing" (SYN-PUB-10456, SYN-PUB-10455). The model will be trained on a subset of 2022–23 logs. Zrenjanin will engage two partner teachers to provide retrospective judgments on a small, blinded sample of student sessions, which serves as a sanity check for state labeling (pedagogy input from Tatjana, ~1 day/week). The output is a scoring rubric, not retraining an entire platform.

3. **Packaging for classroom use (Months 9–12).** Mitrović's group will serialize the model into a Python script that processes new CSV exports and outputs a simple per-student report (e.g., confidence band of guessing). Zrenjanin integrates this into a testable offline prototype for teacher feedback. A joint technical report describing the method, limitations, and validation against teacher judgments will be drafted.

**What each side brings.**
Mitrović contributes expertise in modelling competency states from log data (SYN-PUB-10456), sequence clustering of engagement patterns (SYN-PUB-10455), and time-to-mastery survival models (SYN-PUB-06872). The department offers computational resources and master's student time for data preparation. Zrenjanin brings a unique longitudinal dataset (4,200 students, two school years), production-level understanding of its game logic, direct access to end-user teachers, and the deployment pathway for any resulting tool within existing annual service contracts (C002).

**Risk factors and failure modes.**
The project will fail if the logs lack sufficient variability—for example, if most sessions are too short or the guessing pattern is indistinguishable from a true novice who has not yet built fluency. Another failure mode is misalignment between model-derived labels and teacher intuition, which would limit classroom adoption. Finally, if Zrenjanin's production deadlines compress the one-day-per-week commitment before the feature prototype is stable, the validation loop with teachers becomes superficial and the resulting rubric may not survive real classroom use.

---

## 3. OsiguroMi d.o.o. × Žarko Pejić

- **Challenge:** C004-CH1
- **Fit:** 95%
- **Why:** Žarko Pejić's PhD and current work are directly on geostatistical downscaling of satellite precipitation for agricultural index insurance in Vojvodina, addressing exactly the spatial mismatch and data fusion problem described.
- **Proposal:** `P-C004-CH1-R0364`

## The Concrete Problem

OsiguroMi’s weather-triggered parametric crop product uses the nearest official meteorological station as the sole rainfall proxy. In the flat but microclimatically varied Vojvodina and Bačka regions, this introduces basis risk: fields receive payouts when no drought occurred, or are denied when crops have failed, because the station can be too distant to represent local conditions (C004-CH1). An internal adjustment using historical station-to-field biases proved too coarse. The company needs a spatially continuous, parcel-level rainfall estimate that blends its accessible network of ~140 public and private agro-meteorological gauges with satellite-derived precipitation fields, without replacing the contractual index structure.

## First-Year Joint Work Plan

**Phase 1 – Data preparation and exploratory fusion (Months 1–3)**
- Researcher Žarko Pejić assembles and quality-controls the multi-source gauge records provided by OsiguroMi, and extracts coincident IMERG and PERSIANN-CDR satellite precipitation grids for the study domain (SYN-PUB-04013).
- Two senior OsiguroMi engineers deliver a cleaned, timestamped dataset from the 140-point network and define the precise contractual rainfall-deficit thresholds per crop and polygon.

**Phase 2 – Geostatistical downscaling to 1 km (Months 4–6)**
- Pejić applies Kriging with External Drift (KED), using satellite precipitation fields as a covariate, to produce daily and event-accumulated rainfall maps at 1 km × 1 km resolution (SYN-PUB-04461).
- The company’s data-modelling researcher validates the output against withheld gauge subsets and existing claim/payout records from the last two seasons.

**Phase 3 – Index prototype and operational test (Months 7–9)**
- A prototype rainfall-deficit index is computed on the fused 1 km grid and compared against the current station-based index for a portfolio of real insured parcels.
- OsiguroMi’s engineers package the method as a Python module within the existing B2B analytics dashboard, enabling automated map-based pay-out simulation.

**Final deliverable:** A bias-corrected, multi-source rainfall field service that OsiguroMi can deploy for the upcoming agricultural season, plus a technical report quantifying basis-risk reduction.

## What Each Side Brings

**BioSense Institute / Žarko Pejić**
- Proven expertise in satellite precipitation evaluation over the Middle Danube Basin (SYN-PUB-04013) and rainfall interpolation across Vojvodina’s sparse station network (SYN-PUB-04460).
- Developed methodology for KED using IMERG to achieve sub-monthly mapping at 1 km in northern Serbia (SYN-PUB-04461).
- Experience designing and testing spatial sensitivity of rainfall-deficit indices for maize insurance in the same agricultural region (SYN-PUB-04462).
- Previous consultancy for a regional agro-insurance intermediary in Novi Sad confirmed practical understanding of product requirements (R0364).

**OsiguroMi**
- Access to dense, real-time rainfall observations from the national hydrometeorological service plus three private agro-meteorological networks, totalling ~140 measurement points (C004-CH1).
- Existing parametric insurance product with live policyholder portfolios in Vojvodina and Bačka that demand immediate applicability (C004-CH1).
- Two senior engineers and one in-house data modeller available for 9-month co-development cycle, ensuring integration into production systems.
- Distribution infrastructure: the white-label API and real-time B2B payout dashboard can operationalise new rainfall indices without a separate IT project.

## What Would Make It Fail

1. **Persistent satellite gauge bias.** If IMERG or PERSIANN-CDR exhibits systematic over-/underestimation that KED cannot correct—particularly during convective summer storms—the fused product may be no better than a simple kriging of the densified gauge network alone, and basis risk remains unacceptable.
2. **Poor temporal granularity of historical claims.** If the company’s claim records lack precise geo-coordinates or parcel-specific loss dates, validation against actual farmer losses becomes impossible, and neither side can prove the new index reduces wrong payouts.
3. **Scale mismatch with contractual triggers.** If the legal wording of insurance policies ties payout exclusively to a named official station, even a perfect 1 km grid may be rejected by reinsurance partners or regulators, blocking operational use.
4. **Engineering capacity bottleneck.** If the company’s senior engineers are pulled into other product lines before the Python module reaches production readiness (Month 9), the method remains an academic prototype.


---

## 4. PravniPilot a.d. × Gordana Đurić

- **Challenge:** C006-CH2
- **Fit:** 70%
- **Why:** Directly relevant EU private law and cross-border commerce expertise, but lacks corporate/finance specialization needed for convertible note restructuring and cap table modeling.
- **Proposal:** `P-C006-CH2-R0547`

## The Problem
PravniPilot a.d.’s planned €2.5M Series A to fund a German market entry is blocked. Three venture funds expressed product interest but rejected the deal in Q1 because the 2019 convertible note created a messy cap table with overlapping anti-dilution provisions [C006-CH2]. This is a corporate restructuring problem, but the *use of funds*—translating an AI legal-research platform for German courts and clients—raises an immediate, parallel regulatory risk that no investor has yet stress-tested. The platform’s core features (case-outcome prediction, document summarization with source citation) must comply with the EU Digital Services Act (DSA), the German Rechtsdienstleistungsgesetz (RDG), and EU consumer-protection rules the moment it serves German users. A venture fund that sees a cleaned cap table will next ask for a DSA compliance roadmap. We lack that roadmap.

## What We Would Do in Year One
**Months 1–3: Regulatory Triaging & Entity-Design Blueprint.** Gordana Đurić’s group would produce a structured gap analysis mapping PravniPilot’s existing AI-assisted legal portal against DSA Article 14–15 (notice-and-action, transparency reporting) and the trader-identification obligations studied in her published comparative work on marketplace liability [SYN-PUB-06378], [SYN-PUB-06379]. PravniPilot engineers (two days/week) would supply feature descriptions and data-flow diagrams. The output is a prioritized compliance checklist that doubles as a technical appendix for investor Q&A.

**Months 4–9: Terms-of-Service and Consumer-Facing Disclosure Drafting.** Building on her analysis of unfair commercial practices and standard contract terms [SYN-PUB-06377], [SYN-PUB-06379], Đurić’s team would draft a German-law-compliant terms-of-service module and mandatory pre-contractual disclosures for B2C users. PravniPilot’s data scientists would simultaneously prototype a “compliance-by-design” tagging system that flags whether a generated summary constitutes legal advice requiring a human-in-the-loop disclaimer under German professional law.

**Months 10–12: Investor-Ready Documentation Package.** The collaboration would package the gap analysis, model terms, and entity-structure recommendation (e.g., whether to operate via a German subsidiary or a Serbian GmbH with a Berlin branch) into a definitive regulatory roadmap. This roadmap sits alongside the cleaned cap table and directly answers the compliance-diligence question that follows financial restructuring.

## What Each Side Brings
**Gordana Đurić (R0547) brings:** Deep comparative expertise in the DSA’s platform-liability regime, EU consumer law transposition in the Western Balkans, and cross-border standard contract terms [R0547], [SYN-PUB-06376], [SYN-PUB-06378]. She has already provided DSA and Platform-to-Business Regulation compliance opinions to two Serbian e-commerce operators [R0547] and can deliver defined-scope legal analysis without an open-ended retainer.

**PravniPilot (C006) brings:** A production-grade AI legal-research portal, case-outcome prediction module, and document-summarization tool with source citations, already live in three jurisdictions [C006]. The engineering team (14 engineers, 2 data scientists) can allocate two days/week to translate platform behavior into the regulatory-legal specifications Đurić requires [C006]. The company also brings a live commercial context that turns academic regulatory analysis into a concrete, investor-validated work product.

## What Would Make It Fail
1.  **Missequenced corporate cleanup.** If the convertible note restructuring stalls beyond Q3, no venture fund will sign a term sheet, and the Series A that funds the German build disappears. The regulatory roadmap would then lack an immediate commercial trigger.
2.  **Expansion without regulatory design.** If management obtains legal restructuring advice elsewhere and rushes a German launch without the DSA+RDG compliance package, a regulatory enforcement action from a German consumer-protection body or law society could freeze the product before it generates revenue.
3.  **Capacity evaporation.** If PravniPilot’s engineering allocation drops below two consistent days/week or Đurić’s autumn-2025 availability window shifts, deliverables slip past the investor-readiness deadline.

---

## 5. AutomVoj a.d. × Bojan Erić

- **Challenge:** C003-CH1
- **Fit:** 9%
- **Why:** Research directly matches the challenge: low-temperature fatigue and fracture mechanics of welded steel joints, including thermal cycling effects, which aligns with the suspected crack causes.
- **Proposal:** `P-C003-CH1-R0365`

## Problem

AutomVoj a.d. (C003) is experiencing premature weld cracking at the crossmember-to-stringer connections of mild steel hollow-section conveyor frames operating in customer cold stores at 2–6 °C (C003-CH1). Fourteen frames have been replaced under warranty this year, causing significant material, travel, and labour costs. The failure occurs after approximately 18 months of continuous use, yet workshop tests at room temperature cannot reproduce it (C003-CH1). The company suspects a combined effect of low-temperature operation, thermal cycling, condensation, and vibration loading, but lacks the low-temperature cyclic testing capability and fracture-mechanics expertise to diagnose and resolve the issue (C003-CH1).

## Proposed Work

Dr Bojan Erić’s group at the University of Novi Sad specialises in fatigue and fracture of welded structural steel under combined mechanical and low-temperature thermal cycling (R0365, SYN-PUB-04474, SYN-PUB-04475). The year-1 plan addresses the problem in three phases:

**Phase 1 – Characterisation and autopsy (months 1–3)**
- The company will ship two failed frame sections with documented crack locations and service histories to the university (C003-CH1).
- Dr Erić’s team will perform metallurgical and fractographic examination of the cracked welds and measure residual stresses using their in-house digital image correlation (DIC) setup (R0365).
- A finite element (FE) model of the as-welded joint geometry will be built in Abaqus to compute the as-manufactured residual stress field (R0365).

**Phase 2 – Laboratory reproduction of failure (months 4–9)**
- The university will design and execute a low-temperature fatigue test campaign on welded coupons extracted from the returned frames and on new coupons prepared by the company using its current welding procedure (C003-CH1).
- Tests will be run on Dr Erić’s servo-hydraulic fatigue machine inside the climate chamber capable of −60 °C (R0365).
- Loading will replicate the recorded vibration spectrum from the conveyor belts, superimposed with thermal cycles between ambient and 2 °C to reproduce condensation effects.
- Crack initiation and growth will be monitored and compared with field observations.

**Phase 3 – Root-cause identification and remediation options (months 10–12)**
- The experimental results and a parametric FE study will isolate the primary drivers (e.g., low-cycle fatigue, thermal stress ratcheting, corrosion-fatigue).
- The university will deliver a confidential report specifying the failure mechanism(s) and propose modifications to the welding procedure, filler material, or joint design.
- Two half-day review meetings will be held at the company’s premises to discuss findings and implementation.

## What Each Side Brings

**AutomVoj a.d.** provides the problem definition, two failed frame assemblies with full site-collected data (C003-CH1), new welded specimens fabricated to its standard procedure, and access for the university team to observe a live installation and collect vibration/temperature data. The chief engineer and senior automation engineers will allocate time to guide the investigation and validate practical feasibility (C003).

**University of Novi Sad (Dr Erić)** contributes a climate chamber to −60 °C, servo-hydraulic fatigue testing capability, DIC residual-stress measurement, expertise in welded-joint fracture mechanics under low-temperature and thermal cycling (SYN-PUB-04474, SYN-PUB-04475, SYN-PUB-04472), and the ability to build FE models that capture crack driving forces (R0365). The project can also involve a master’s student for the experimental work, supervised by Dr Erić (R0365).

## Why It Might Fail

- The actual failure mechanism may depend on factors not reproduced in the lab, such as in-situ corrosion-fatigue from condensation chemistry or unexpected overloads during cleaning, leading to a “no-failure” outcome in the test programme.
- Vibration and thermal data collected from live installations may be insufficient to define representative loading spectra, making the lab loading unrepresentative.
- The project timeline is tight; delays in specimen fabrication by the company or climate-chamber scheduling conflicts could postpone the test campaign beyond the 12-month window.

---

## Challenges left unmatched (on purpose)

The system is allowed to conclude that a challenge has no defensible pair. Proposing a weak collaboration is worse than saying so.

- C004-CH2: We process around 9,000 travel-delay claims per month fully automatically, but our internal audit found that 3.1% of payouts were triggered by data errors from the flight-status API rather than genuine delays — that's real money leaking out every month.
- C005-CH1: Our 72-hour ECG patch consumes 18 mAh per day when Bluetooth is on, which means the battery barely lasts the full wear period in patients who move a lot; we need to cut active current draw by at least 35% without reducing sampling rate below 250 Hz.
