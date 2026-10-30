# EUREKA — portfolio

5 collaborations proposed from 12 company challenges, after 9 critic rejections.

## 1. AutomVoj a.d. × Bojan Erić

- **Challenge:** C003-CH1
- **Fit:** 98%
- **Why:** Directly researches low-temperature fatigue crack growth in welded steel joints, with FEA and variable-amplitude loading expertise that matches the thermal-cyclic vibration failure mode.
- **Proposal:** `P-C003-CH1-R0365`

AutomVoj a.d. faces a specific, costly problem: in-service conveyor frames fabricated from mild steel hollow sections, welded and painted for corrosion protection, experience systematic weld cracking at the main crossmember-to-stringer connections after roughly 18 months of operation in customer cold stores at 2 °C to 6 °C. Standard workshop testing at room temperature cannot reproduce these failures, resulting in 14 warranty replacements this year. We propose a joint root-cause investigation combining AutomVoj's field failure data and domain knowledge with the low-temperature fatigue and structural integrity testing capabilities of Prof. Dr. Bojan Erić's research group.

**What AutomVoj a.d. will do in the first 12 months:**
- Supply two failed frame sections currently in storage, accompanied by site photographs and crack-site measurements (C003-CH1).
- Provide full material and fabrication specifications, including welding procedure details, filler material grade, and drawing for the crossmember-to-stringer joint.
- Fabricate to confirmed specifications a pre-agreed quantity of representative welded T-joint and cruciform test specimens from the same stock of mild steel hollow section.
- Facilitate one site visit for the research team to a live cold-store installation to observe actual operating conditions and collect vibration/temperature data (to be confirmed).

**What the research group (R0365) will do in the first 12 months:**
- Perform controlled fatigue crack growth experiments on the supplied test specimens inside a servo-hydraulic test frame equipped with a climate chamber capable of reaching −60 °C (R0365). The test matrix will replicate the suspected failure environment: temperature at 2–6 °C, cyclic mechanical loading to simulate vibratory belt loads, and periodic thermal cycling to induce condensation effects.
- Quantify residual stress distribution in the as-welded joint condition using established experimental or numerical techniques prior to fatigue testing, referencing work on post-weld residual stress in structural steel welds (SYN-PUB-04473).
- Develop a finite element model of the joint to compute stress intensity factors and predict crack propagation rates under variable-amplitude, low-temperature loading, building directly on prior simulations of fillet-welded S355 steel (SYN-PUB-04472) and low-cycle fatigue of cruciform joints at −40 °C (SYN-PUB-04474).
- Correlate experimental results with the thermal-cycle interaction effects already documented for butt-welded plates (SYN-PUB-04475) and adapt the methodology to the specific AutomVoj joint geometry.
- Deliver a concise technical report identifying the root cause mechanism and recommending actionable changes to the welding procedure, filler material, or joint design.

**What could make this fail:**
- The laboratory climate chamber cycling frequency cannot practically reproduce the exact 18-month timeline of intermittent condensation and corrosion, limiting crack-initiation insight.
- The failure mode in the field is primarily driven by an undocumented overload event during installation or maintenance that is not revealed during the site visit.

**Unverified evidence and risks:**
We were unable to verify through provided synthesis records any joint projects between Bojan Erić and an industrial conveyor manufacturer, nor any prior direct-to-production repair implementation record. This introduces risk around translating a validated root cause into a production-ready welding change within the project timeline.

---

## 2. OsiguroMi d.o.o. × Žarko Pejić

- **Challenge:** C004-CH1
- **Fit:** 98%
- **Why:** Žarko Pejić's work on geostatistical interpolation, satellite precipitation downscaling, and field-level weather indices for Vojvodina directly addresses the need to correct station-to-field rainfall discrepancies.
- **Proposal:** `P-C004-CH1-R0364`

OsiguroMi’s parametric crop insurance pays out when rainfall measured at the nearest official station falls below a contractual threshold, but the station is sometimes 30 km from the field (C004-CH1), leading to false payouts and denied claims. We propose a one-year collaboration between OsiguroMi and Dr Žarko Pejić (BioSense Institute) to develop a field-level rainfall estimator that blends ground gauges, private agro-meteorological networks, and satellite precipitation data, producing a corrected index that can serve as an adjusted trigger without rewriting the policy wording.

**Problem Statement**
The 30 km gap between official stations and insured parcels can contain mountains, river valleys, or urban zones that drastically alter local rainfall (C004-CH1). The company has access to roughly 140 measurement points across the region from RHMZS and three private networks (C004-CH1) but lacks a method to combine them with satellite-derived soil moisture or precipitation into a single, defensible trigger.

**What OsiguroMi Brings**
OsiguroMi provides the domain-specific claim and payout history, the operational requirement that results be implementable within a six-to-nine-month window, and access to the approximately 140-point multi-source gauge network currently used for manual threshold corrections (C004-CH1).

**What Dr Pejić Brings**
Dr Pejić has directly evaluated satellite precipitation (PERSIANN-CDR) over the Middle Danube Basin (2003–2013) against ground observations (SYN-PUB-04013) and has designed a rainfall deficit index for maize insurance in Vojvodina, analysing sensitivity to spatial resolution of input grids (SYN-PUB-04462). He has also applied kriging with external drift using IMERG precipitation as a covariate for sub-monthly 1 km rainfall mapping in northern Serbia (SYN-PUB-04461) and compared IDW and ordinary kriging for monthly rainfall interpolation on a sparse Vojvodina station network (SYN-PUB-04460). His group maintains access to dense gauge networks for short deployment campaigns (R0364) and works within a high-performance computing environment using QGIS, R, and Python (R0364).

**Year-One Work Plan**
1. **Data fusion and quality control (Months 1–3):** Ingest OsiguroMi’s 140-point gauge archive and evaluate bias characteristics of IMERG and PERSIANN-CDR satellite retrievals across the portfolio region, following the evaluation framework of SYN-PUB-04013.
2. **Geostatistical downscaling engine (Months 4–7):** Build a kriging with external drift model (SYN-PUB-04461) that uses satellite precipitation fields as the drift covariate and local gauges as the primary variable, outputting a 1 km daily rainfall surface for each insured parcel. Compare performance against a simpler IDW/ordinary kriging baseline (SYN-PUB-04460).
3. **Index sensitivity and threshold prototyping (Months 8–10):** Recalculate the rainfall deficit index on the downscaled grids and quantify how the spatial resolution of the input changes the frequency of trigger events, extending the methodology of SYN-PUB-04462. Deliver a corrected per-parcel rainfall estimate that can be mapped onto the existing contractual threshold logic.
4. **Operational handover (Months 11–12):** Package the model as documented Python/R scripts with sample configuration files, and provide training to OsiguroMi’s data team so that the pipeline can run alongside the current station-based trigger for a live dry-run parallel to the next agricultural season.

**Likely Failure Modes**
The project would fail if the OsiguroMi gauge data are not spatially representative of actual insured parcel locations, or if the six-to-nine-month implementation constraint precludes adequate validation on historical claims. A secondary failure risk is that regulatory or reinsurance partners reject a blended satellite-gauge index while the policy wording still names a single physical station.

**Unverifiable Evidence and Critical Missing Information**
The description of OsiguroMi’s internal research capacity (one internal data researcher and two senior engineers) could not be verified against the provided source texts. The actual spatial distribution and temporal completeness of the ~140 gauges, and the number of historical claims available for back-testing, are absent from the supplied material and would need clarification before contracting.

---

## 3. Zrenjanin Game Works d.o.o. × Danilo Mitrović

- **Challenge:** C002-CH1
- **Fit:** 97%
- **Why:** Directly specializes in clickstream analysis and competency prediction from learning logs, with expertise in longitudinal modeling and sequence mining that directly addresses separating guessing from understanding.
- **Proposal:** `P-C002-CH1-R1006`

**Problem**
Teachers using Zrenjanin Game Works' math games cannot distinguish genuine learning from rapid, patternless guessing in student clickstream data, a problem confirmed when a student with a 91% in-game score failed manual offline testing (C002-CH1). The company lacks a reliable, explainable detection method.

**Proposed First-Year Collaboration**
- **Design a "Guess Likelihood" Feature Set (Months 1–4):** Mitrović will design temporal and sequential features from the raw clickstream logs (C002-CH1) — including response-time distributions, streak patterns of correct/incorrect answers, and answer-switching behaviour — specifically tuned to flag the "fast random clicker" scenario. Kovačević (C002) will provide one day of domain expertise per week (C002) to capture in-game behavioural norms.
- **Build & Validate a Teacher-Facing Prototype (Months 5–10):** Using anonymised data from the 4,200-student cohort across two school years (C002-CH1), Mitrović will train a transparent model (e.g. logistic regression or rule-based decision list) that outputs a per-student daily guess-likelihood score. The model will be packaged in a lightweight script that ingests CSVs and produces a flagging report.
- **Pilot Test in Classrooms (Months 11–12):** Zrenjanin Game Works will deploy the tool with 5–10 volunteer teachers pre-2025–26 (C002-CH1). Teachers will compare the tool’s flags against their own offline assessments, providing feedback for final calibration.

**What Each Side Brings**
- **Zrenjanin Game Works:** Real-world clickstream data with known edge cases (C002-CH1), a direct link to practising teachers for piloting, and deep understanding of the game mechanics causing specific click patterns.
- **Mitrović (R1006):** Research expertise in “Applying Hidden Markov Models to Detect Shifts in Student Learning States from Clickstream Data” (SYN-PUB-10456) and sequence-based student modelling (SYN-PUB-10455). Mitrović also brings validated workflows from university-led learning analytics projects (R1006).

**What Would Make It Fail**
- The game clickstream lacks sufficient temporal grain (e.g., no mousedown/mouseup, only final click) to distinguish a deliberative pause from a rapid cascade of clicks across unrelated buttons.
- High teacher turnover or end-of-year rush prevents reliable ground-truth collection during the pilot, leaving the model’s flagging accuracy unvalidated.
- The project stalls if development time exceeds the available one day per week from the company side (C002) without a clear decision-maker to unblock data quality issues.

**Evidence I Could Not Verify**
The 4,200-student count and two-school-year span are cited externally but not independently confirmed from the provided dataset sources.


---

## 4. ArmaturaSec d.o.o. × Krisztina Kiss

- **Challenge:** C001-CH1
- **Fit:** 95%
- **Why:** Directly addresses unsupervised anomaly detection on Modbus/ICS networks, fitting the 'learn normal, flag drift' requirement with known statistical one-class models deployable on edge hardware.
- **Proposal:** `P-C001-CH1-R1008`

ArmaturaSec's challenge is that its ProtoSense module, which passively monitors Modbus TCP and BACnet/IP traffic, needs to flag suspicious activity without any examples of malicious traffic. This proposal outlines a one-year collaboration to build, validate, and deploy a statistical baseline anomaly detector for these protocols.

**The Core Problem**
Supervised approaches are not viable; when trained on public ICS datasets, the classifier produced an unacceptable false-positive rate in real deployments, causing clients to disable alerts (C001-CH1). The scientific problem is to define and learn a robust, protocol-aware statistical model of 'normal' per-site behaviour that can run on constrained hardware and be explained to non-specialists.

**What We Will Do in Year One**
Prof. Kiss's group brings established methods for unsupervised and one-class ICS traffic analysis, including statistical baseline modelling and one-class SVM approaches for industrial Ethernet (SYN-PUB-10472, SYN-PUB-10473). The work will proceed in three phases.

Phase 1 (Months 1-4): Protocol-specific feature extraction. Working from ArmaturaSec's traffic archives - which represent several terabytes of normal captures collected over the past three years (C001-CH1) - we will define a compact set of statistical features for Modbus TCP and BACnet/IP. The feature set will focus on inter-arrival times, function code transition probabilities, and register access patterns. ArmaturaSec will provide its ProtoSense parser and one engineer, who has been studying anomaly detection for six months, to resolve protocol ambiguities.

Phase 2 (Months 5-8): Algorithm selection and calibration on the university testbed. We will evaluate and tune one-class SVM and Isolation Forest models against the extracted features (R1008, SYN-PUB-10472, SYN-PUB-10474). Prof. Kiss has testbed capacity for industrial partners under a data-sharing agreement (SYN-PUB-10473). The testbed allows controlled injection of synthetic anomalies to assess sensitivity and calibrate detection thresholds, directly addressing the risk of false-positive drift reported in prior work (SYN-PUB-10474).

Phase 3 (Months 9-12): On-device integration and field evaluation. We will produce a lightweight inference module in C suitable for the NetGuard-OT and NetGuard-OT Mini hardware. ArmaturaSec's engineers will integrate it into a beta firmware release, and we will run a silent evaluation on two or three consenting client sites. The key deliverable is a written report and a plain-language explanation for plant managers: what the detector learned as 'normal', what changed, and why it matters.

**What Each Side Brings**
ArmaturaSec brings operational realism: the traffic archives, the deployed hardware, a customer base with a concrete false-positive problem, and engineering time to deploy the result. Prof. Kiss's group brings the statistical methodology, an independent evaluation environment, and experience from prior collaborations with an energy distributor and a water utility on monitoring data (SYN-PRJ-0511, SYN-PRJ-0512).

**What Would Make It Fail**
This collaboration would fail if the 'several terabytes' of archives turn out to be fundamentally homogeneous from a single site, or if the false-positive suppression required by plant operators is stricter than the statistical separability of normal traffic and injected anomalies allows. Unverified: we have no current customer commitment for a field pilot capture. This must be confirmed before Phase 3.

---

## 5. PravniPilot a.d. × Jovan Puzović

- **Challenge:** C006-CH1
- **Fit:** 94%
- **Why:** Direct overlap: his core work on judicial decision prediction for small, imbalanced Serbian legal datasets, using data augmentation and transfer learning, directly addresses the company's stated accuracy and data volume bottlenecks.
- **Proposal:** `P-C006-CH1-R0484`

## Problem

PravniPilot’s commercial-dispute outcome predictor, trained on roughly 9,000 labelled decisions, achieves only 61% accuracy—barely above a lawyer’s estimate (C006-CH1). The team needs at least 40,000 clean, labelled decisions to reach a marketable 75% accuracy within 12 months (C006-CH1). This proposal addresses the dual bottleneck of data scarcity and model underperformance for Serbian legal texts.

## Year-One Plan

**Months 1–3: Audit & Augmentation Pipeline.** Prof. Puzović’s group will evaluate the current 9,000-decision dataset for feature representation and class imbalance, applying SMOTE/ADASYN variants informed by his prior work on short Serbian legal texts (SYN-PUB-03940). PravniPilot’s data engineer integrates the most promising sampler into the existing pre-processing workflow.

**Months 4–8: Transfer Learning from Croatian, Bosnian, and General Serbian Corpora.** We will adapt Prof. Puzović’s method for back-translation data augmentation on low-resource legal sentences (SYN-PUB-05707) and his proven transfer-learning pipeline from general Croatian–Serbian texts to specialised Serbian labour-law corpora (SYN-PUB-05708). The team will re-target this approach from labour law to commercial disputes. PravniPilot’s annotators will validate 1,000 synthetically generated samples per iteration.

**Months 9–12: Iterative Re-training and Evaluation.** The augmented dataset and re-trained model will be evaluated on a held-out test set monthly. Prof. Puzović will design the evaluation strategy, drawing on baseline studies for Serbian administrative court decisions (SYN-PUB-05706). PravniPilot will manage model integration into their production codebase, with the goal of reaching 75% accuracy and publishing honest confidence intervals.

## What Each Side Brings

**PravniPilot** contributes a proprietary dataset of roughly 9,000 labelled commercial-dispute decisions, one full-time data engineer, and two part-time annotators (C006-CH1). The company will allocate development capacity, as their team of 14 engineers plus two data scientists can dedicate roughly two days per week to collaborative research (C006). The production environment and integration pathway are company-owned.

**Prof. Puzović** contributes a research track record in class imbalance on Serbian court decisions (SYN-PUB-03940, SYN-PUB-05706), back-translation for low-resource legal text (SYN-PUB-05707), and transfer learning between Croatian–Serbian legal domains (SYN-PUB-05708). His group brings expertise in SMOTE variants, small-sample learning, and synthetic data generation (R0484). Available compute includes the Faculty’s shared GPU cluster (R0484).

## Risk Factors

- **Data availability from neighbouring jurisdictions remains unverified:** We could not confirm access to structured Croatian or Bosnian court datasets sufficient for effective transfer learning. If these are unavailable or poorly aligned, the approach will fail to bridge the gap to 40,000 clean samples.
- **Co-supervisory capacity:** The researcher is co-supervising two PhD students expected to finish in 2026–2027, which limits availability for large new commitments until mid-2026 (R0484).
- **Integration friction:** If augmentation techniques produce text patterns not recognised by PravniPilot’s production pipeline, volume gains will not translate to a deployed model improvement.

## Unverified Claim

We could not verify the actual availability, format, or volume of Croatian or Bosnian court rulings to enable the transfer learning step; without this, the project would lack the core data source needed to amplify the Serbian training set.

---

## Challenges left unmatched (on purpose)

The system is allowed to conclude that a challenge has no defensible pair. Proposing a weak collaboration is worse than saying so.

- C001-CH2: Our appliance firmware update process currently requires a technician on-site at the customer's substation; we want secure over-the-air updates, but every approach we've prototyped either has an unacceptable attack surface or fails when the GPRS link drops mid-transfer.
- C006-CH2: We are trying to raise a €2.5 million Series A round to fund expansion into the German legal market but all three venture funds we spoke to in Q1 said our cap table structure is too messy from the 2019 convertible note round; we need legal restructuring advice, not technology.
