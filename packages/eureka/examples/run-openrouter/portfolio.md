# EUREKA — portfolio

3 collaborations proposed from 4 company challenges, after 0 critic rejections.

## 1. ArmaturaSec d.o.o. × Krisztina Kiss

- **Challenge:** C001-CH1
- **Fit:** 95%
- **Why:** Krisztina Kiss's direct expertise in unsupervised anomaly detection for Modbus/ICS traffic perfectly addresses the core need: learning 'normal' from terabytes of benign data without attack labels.
- **Proposal:** `P-C001-CH1-R1008`

## 1. The Problem: Silent Failures in Zero-Attack-Data Environments

ArmaturaSec's ProtoSense module monitors Modbus TCP and BACnet/IP traffic, but its supervised classifier, trained on public datasets, generates unacceptably high false positive rates in production. Clients disable alerts. The core issue is the complete absence of labelled attack data from client sites (C001-CH1). A detection approach that requires malicious examples is fundamentally broken here. Instead, the operational need is for a model that learns the statistical profile of normal traffic at a specific site and flags deviations without ever seeing an attack.

## 2. Proposed First-Year Collaboration: Engineering a Deployable Baseline Model

This 12-month project will transition Prof. Krisztina Kiss's research on unsupervised anomaly detection for industrial protocols from her testbed directly into an evaluative deployment on ArmaturaSec's NetGuard-OT appliance. The goal is not a theoretical paper but a field-ready detector component.

**Phase 1 (Months 1-4): Method Selection and Offline Profiling.** The university group will apply one-class classification methods, specifically the Isolation Forest and one-class SVM models (SYN-PUB-10475, SYN-PUB-10473), to a sanitized, representative sample of ArmaturaSec's terabytes of benign Modbus traffic (C001-CH1). The objective is to perform a sensitivity analysis of algorithm parameters—contamination fraction, window length (SYN-PUB-10475)—against this specific dataset to select the most stable algorithm. ArmaturaSec will provide the traffic archives and engineering context on packet structure and normal operational rhythms (C001).

**Phase 2 (Months 5-9): Feature Engineering and Explainability.** The core technical challenge is translating statistical deviations into plain-language alarms for a plant manager. We will engineer features based on Prof. Kiss's statistical baseline modelling work (SYN-PUB-10472), focusing on periods, function code sequences, and register poll frequencies. The university will develop a traceability layer that maps an anomaly score back to a specific, human-readable deviation (e.g., "Unusual burst of write commands to programmable logic controller register 40001"). ArmaturaSec engineers will co-design this explanation schema and integrate a proof-of-concept model into the NetGuard-OT firmware stack for offline testing on actual hardware (C001).

**Phase 3 (Months 10-12): Validation on Live Hardware and Deployment Roadmap.** The final phase involves deploying the model as a passive, non-alerting observer on one consented, live client network through the NetGuard-OT appliance (C001). This will validate hardware performance and detect any drift-induced false positives before offering it as a feature. The deliverable is a technical report on model performance, a list of false positives from the live observation period, and a detailed integration specification for the ArmaturaSec Managed Support firmware update.

## 3. What Each Side Contributes

*   **ArmaturaSec d.o.o.** provides the critical real-world validation opportunity that is normally absent in academic work. This includes: terabytes of curated, benign Modbus/BACnet traffic archives from consenting clients (C001-CH1); the NetGuard-OT hardware bench for resource-constrained inference testing; one to two part-time embedded engineers with access to the existing firmware codebase for integration support (C001); and the production deployment channel for a live pilot.

*   **Prof. Krisztina Kiss's Research Group** contributes the specific algorithmic expertise that avoids the supervised classifier pitfall. This includes: deep knowledge of one-class classification (Isolation Forest, one-class SVM) for industrial protocols (SYN-PUB-10473, SYN-PUB-10475); a proven methodology for statistical baseline modelling of Modbus traffic (SYN-PUB-10472); and prior experience validating research on an ICS testbed with real traffic generators (SYN-PUB-10474). A graduate student can be funded for focused work on feature engineering and evaluation.

## 4. Why This Collaboration Could Fail

*   **Unexplained False Positives Erode Trust.** If the explanation module does not provide a root cause that a plant manager understands, the new detector will be silenced just like the old one, regardless of its statistical accuracy.
*   **Hardware Constraints Prevent Deployment.** The chosen algorithm may not run efficiently enough on the NetGuard-OT appliance's embedded processor, even after optimization, making it an interesting research result with no product path.
*   **Traffic Homogeneity.** If the real client traffic is extremely simplistic and invariant, the model will learn a threshold that is too tight, generating a flood of nuisance alarms for the slightest legitimate operational change, such as a manual override by an engineer.

---

## 2. Zrenjanin Game Works d.o.o. × Danilo Mitrović

- **Challenge:** C002-CH1
- **Fit:** 95%
- **Why:** Mitrović's core expertise is clickstream analysis for student modelling, directly matching the company's task of distinguishing guessing from learning using their existing log data. His work with hidden Markov models is ideal for this sequential behaviour pattern problem.
- **Proposal:** `P-C002-CH1-R1006`

**Problem.** Teachers using Zrenjanin Game Works' math games report a critical gap: a high in-game score does not reflect a child's actual understanding. A documented case showed a student with a 91% score failed equivalent paper tests, indicating rapid, random clicking that the system could not flag (C002-CH1). The company possesses rich clickstream data (timestamp, question ID, answer, response time, attempts) for 4,200 students, but lacks the analytical method to distinguish systematic guessing from genuine competency (C002-CH1).

**Proposed Solution & First-Year Plan.**
We propose a joint 12-month project to develop and validate a statistical model that flags likely guessers. The core hypothesis is that guessing manifests as a distinct, identifiable latent state in a student's clickstream sequence. The work will progress in three phases:

1.  **Data Preparation & Exploratory Analysis (Months 1-3).** Mitrović's team will receive anonymized CSV log exports. They will engineer time-series features like response time entropy, answer-switching frequency, and performance stability. Zrenjanin staff (Miroslav Kovačević) will provide critical domain context on game mechanics and question difficulty to inform feature selection.
2.  **Model Development & Internal Validation (Months 4-8).** Mitrović will apply Hidden Markov Models (HMMs) to model student learning as a sequence of latent states (e.g., "mastered," "confused," "guessing"), a technique he has previously validated for detecting shifts in learning states from clickstream data (SYN-PUB-10456). The model will output a probability of a student being in a "guessing" state for each session. A baseline logistic regression model using engineered features will also be built for comparison (SYN-PUB-10454).
3.  **External Validation & Tool Prototyping (Months 9-12).** Zrenjanin's pedagogy expert (Tatjana) will coordinate with a small subset of partner teachers to collect contemporaneous paper-based or observational assessment data. This ground truth will be used to externally validate the model's predictions. The deliverable is a working prototype script that ingests new log files and outputs a simple teacher-facing dashboard mock-up flagging at-risk students, calibrated for the 2025–26 school year (C002-CH1).

**What Each Side Brings.**
*   **Researcher (Mitrović):** Core expertise in educational data mining, specifically clickstream analysis, HMMs for state detection (SYN-PUB-10456), and time-to-mastery modeling (SYN-PUB-06872). Provides the statistical methodology and model development capacity.
*   **Company (Zrenjanin Game Works):** Proprietary, real-world clickstream dataset for 4,200 students (C002-CH1), direct access to teacher feedback for validation, and essential domain knowledge of the game design and curriculum alignment (C002). Miroslav Kovačević will provide one day per week of dedicated development and liaison support (C002).

**Key Risks & Mitigation.**
*   **Insufficient Signal:** The log data may lack the temporal resolution or features to cleanly separate guessing from confusion. *Mitigation:* Phase 1 will explicitly test this; if the signal is absent, we pivot to a minimum viable product based on simpler thresholds validated against the ground truth.
*   **Ground Truth Validity:** External paper tests may not perfectly correlate with in-game learning. *Mitigation:* The validation protocol will use teacher judgment triangulated with short, game-like diagnostic tasks, not just formal tests.
*   **Researcher Availability:** Mitrović's portfolio lists corporate HR analytics as a primary interest (R1006). *Mitigation:* This risk must be addressed in the initial contracting to confirm a minimum 0.25 FTE commitment to this K-12 focused project.

---

## 3. AutomVoj a.d. × Bojan Erić

- **Challenge:** C003-CH1
- **Fit:** 95%
- **Why:** Direct expertise in low-temperature fatigue, fracture mechanics of welded steel joints, and thermal cycling—exactly matching the core failure hypothesis and need for root-cause analysis.
- **Proposal:** `P-C003-CH1-R0365`

**Problem**
AutomVoj a.d. is experiencing systematic weld cracking at crossmember-to-stringer connections on conveyor frames operating in customer cold stores (2–6 °C). Fourteen complete frame assemblies have been replaced under warranty this year. The failure surfaces and timing (~18 months) strongly suggest a fatigue mechanism promoted by low-temperature service conditions, but the failure cannot be reproduced in AutomVoj’s workshop under ambient-temperature load tests (C003-CH1). Without understanding the root cause, changes to welding procedure, filler material, or joint design remain guesswork, and warranty costs continue.

**Proposed First-Year Work**
The project combines targeted experiments with simulation to identify the driving mechanism and recommend immediate design or process changes.

1. **Failure characterisation.** The two cracked frame sections held in storage will be sectioned and examined by the university team. Fractography (stereo and scanning electron microscopy) will identify crack initiation sites and distinguish between monotonic overload or progressive fatigue crack growth. Hardness traverses and microstructural analysis will check for heat-affected-zone anomalies (R0365; SYN-PUB-04475).

2. **Controlled environment fatigue testing.** Small-scale fillet-welded cruciform specimens, representative of the crossmember-to-stringer detail, will be manufactured from identical mild steel hollow section (supplied by AutomVoj). Tests will be run on the university’s servo-hydraulic fatigue machine inside a climate chamber capable of −60 °C (R0365). Two loading blocks will be applied at +20 °C and at +2 °C, using cyclic loads derived from belt tension and product mass estimates provided by AutomVoj. Digital Image Correlation will map surface strain fields around the weld toe, detecting early crack formation and thermal-strain interactions (SYN-PUB-04474; SYN-PUB-04475).

3. **Thermal cycling interaction.** Additional specimens will be subjected to periodic temperature swings between 2 °C and ambient shop-floor conditions to mimic infrequent defrost or maintenance events. This tests the hypothesis that condensation-driven corrosion fatigue or transient thermal stresses accelerate damage (SYN-PUB-04475).

4. **Finite element simulation.** A 3D elastic–plastic FE model of the joint, incorporating weld geometry scanned from actual frames, will compute local notch stress and stress intensity factor ranges. The model will be validated against the DIC measurements and then used to explore sensitivity to weld toe radius, leg length, and residual stress level (SYN-PRJ-0388; SYN-PUB-04472). By month 9, a concise engineering report will rank contributing factors and deliver specific recommendations—weld profile changes, a low-temperature-suitable filler metal, or post-weld dressing—that AutomVoj can trial on a pilot frame.

**What Each Side Brings**

*AutomVoj a.d.* provides in-service failure history, two failed frame assemblies, material (mild steel hollow section), estimated service load spectra, access to an operating cold-store line for validation measurements if needed, and the commercial urgency that keeps the investigation focused. The company’s chief engineer and senior automation team will guide practical constraints such as weld access and fabrication cost (C003).

*University of Novi Sad (Bojan Erić)* contributes a working group with direct experimental and numerical expertise in low-temperature fatigue of welded structural steel. Available equipment includes a servo-hydraulic fatigue frame, a climate chamber validated down to −60 °C, and a DIC system for full-field strain measurement (R0365). Previous projects have examined fatigue crack propagation in fillet-welded S355 steel under variable-amplitude loading (SYN-PUB-04472) and low-cycle fatigue of cruciform joints at −40 °C (SYN-PUB-04474). The group’s experience in residual-stress measurement and FE stress analysis (SYN-PUB-04473; SYN-PRJ-0389) ensures the simulation work is grounded in experimental validation.

**What Would Make It Fail**

- **Insufficient load definition.** If AutomVoj cannot provide credible estimates of belt tension ranges, product-induced live loads, and start–stop transients, the laboratory loading will be unrepresentative and the findings irrelevant.
- **Unanticipated corrosion mechanism.** If the crack surfaces retrieved from the field show the primary driver is a specific condensate chemistry (e.g., chlorine-based cleaning agents) rather than pure mechanical fatigue, the proposed mechanical-thermal test matrix may miss the key variable. The fractography in Work Package 1 is designed to catch this early, but a switch to an electro-chemical investigation would require re-scoping.
- **Excessive residual stress scatter.** If the as-welded residual stress state in the production frames varies dramatically and dominates the fatigue life, a small laboratory specimen program may fail to capture the statistical worst case, leading to recommendations that do not prevent future field failures.

---

## Challenges left unmatched (on purpose)

The system is allowed to conclude that a challenge has no defensible pair. Proposing a weak collaboration is worse than saying so.

- C004-CH1: Our weather-triggered crop parametric product pays out when measured rainfall at the nearest official station drops below a threshold, but farmers tell us the station is sometimes 30 km away and their field got rain while the station recorded drought — we're paying out when we shouldn't and refusing when we should.
