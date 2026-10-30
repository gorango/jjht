# EUREKA — portfolio

4 collaborations proposed from 4 company challenges, after 4 critic rejections.

## 1. ArmaturaSec d.o.o. × Krisztina Kiss

- **Challenge:** C001-CH1
- **Fit:** 95%
- **Why:** Her core research is unsupervised anomaly detection for ICS protocols like Modbus, perfectly matching the challenge's need for site-specific baseline learning without attack examples.
- **Proposal:** `P-C001-CH1-R1008`

## The problem
ArmaturaSec needs to detect unusual behaviour on Modbus and BACnet networks without labelled attack data; their clients have zero confirmed compromises, so supervised classifiers produce unacceptable false positives on real OT traffic (C001-CH1).

## Research questions
1. How can a one-class baseline model of normal Modbus/BACnet behaviour be built per site to achieve a false positive rate below 1% on real OT traffic?
2. What feature representation of ICS protocol traffic allows a plant operator to understand why a deviation from the baseline was flagged?
3. How can such a model be updated incrementally on an industrial appliance without full retraining, to track slow legitimate network changes?

## Plan
| Year | Work | Result |
|------|------|--------|
| 1 | Instrument the ProtoSense parsing path to extract protocol field-value time series from ArmaturaSec's traffic archives. Train a one-class SVM and an Isolation Forest on real, unlabelled Modbus captures. Build a lab testbed at the university for controlled experiments. | Baseline model suite with an AUC of at least 0.95 on held-out normal traffic from three sites and a quantified false positive rate on 30 days of continuous capture from one site. |
| 2 | Design an explainability layer: map anomalous features back to Modbus function codes and BACnet object identifiers. Implement an on-device inference prototype in C on ArmaturaSec's hardware bench. Design an update protocol for incremental retraining. | A firmware module that runs inference on NetGuard-OT hardware, reports root-cause alerts, and updates its baseline without cloud connectivity. |
| 3 | Conduct a live pilot deployment at one energy utility site in Serbia. Integrate detector output into the ArmaturaSec Managed Support dashboard. Evaluate drift detection under scheduled configuration changes. Write and defend the PhD thesis. | Pilot report confirming the target false positive rate is maintained during 90 days of live operation, including one documented legitimate baseline shift event. |

## What each side brings
- **Company:** Access to terabytes of unlabelled Modbus and BACnet captures from consenting clients (C001-CH1). ProtoSense firmware source and a hardware bench for on-device testing (C001). One to two engineers part-time guided by Radovan Čičić (C001).
- **Faculty:** Expertise in one-class classifiers and statistical baseline modelling for ICS protocols (R1008, SYN-PUB-10472, SYN-PUB-10473, SYN-PUB-10475). A dedicated ICS network testbed for long-term controlled experiments (R1008). PhD supervision and rigorous evaluation methodology (R1008).

## Why this pair
Prof. Kiss' publication "Statistical Baseline Modelling of Modbus/TCP Traffic in a Substation Automation Network" (SYN-PUB-10472) provides a direct methodology for the exact problem ArmaturaSec faces: building a normal-behaviour profile of Modbus traffic without attack labels. The company contributes real traffic volume that no public dataset matches, while the faculty provides detection algorithms, a controlled testbed, and a long-term measurement study background (SYN-PUB-10474) essential for moving from a paper to an appliance.

## Agreed up front
Publication review window: 30 days. IP: ArmaturaSec owns the ProtoSense firmware and traffic archives; unpatented methods and evaluation scripts are jointly owned; the University may publish methodology and results after the review window.

## Risks
- The unlabelled archives may contain misconfiguration or maintenance periods that operators never flagged as abnormal, polluting the baseline and increasing the false negative rate.
- Running a one-class model on the NetGuard-OT Mini's embedded CPU may exceed the available compute or memory budget, forcing a reduced feature set that lowers detection accuracy.

## Unverified evidence
- Whether client consent covers using traffic captures as ML training data, beyond existing diagnostics.
- The exact headcount of the university group and the ICS testbed hardware specifications.
- The total volume of the traffic archives in terabytes.
- The candidate's years of experience and specific degree background.

## Supervisors and candidate
Academic supervisor: Prof. Dr. Krisztina Kiss, Full Professor, Department of Computing and Control Engineering, Faculty of Technical Sciences (R1008). Industrial supervisor: Radovan Čičić, Head of Engineering, ArmaturaSec d.o.o. (C001-CH1). Candidate: An engineer employed by ArmaturaSec with network protocol analysis and Python scripting experience, enrolled in the industrial PhD programme, splitting time between Zrenjanin and the university lab.

---

## 2. Zrenjanin Game Works d.o.o. × Danilo Mitrović

- **Challenge:** C002-CH1
- **Fit:** 95%
- **Why:** Directly specializes in educational data mining and clickstream analysis; his work on sequence mining and competency prediction can distinguish random guessing from genuine learning patterns.
- **Proposal:** `P-C002-CH1-R1006`

## The problem
Teachers using Zrenjanin Game Works' primary-school math games cannot distinguish a child who is learning from one who is clicking fast and guessing, despite having detailed timestamped clickstream logs for roughly 4,200 students over two school years (C002-CH1). Simple accuracy thresholds fail; a teacher confirmed a 91%-score student understood nothing when tested on paper.

## Research questions
1. Which features derived from timestamped click sequences best discriminate random guessing from deliberate, knowledge-based responding?
2. Can a Hidden Markov Model be reliably trained to identify latent 'learning states' from in-game clickstreams without requiring paper-test ground truth for every student?
3. What is the minimum interaction length required to flag a likely-guessing student with a false-positive rate acceptable to classroom teachers?

## Plan
| Year | Work | Result |
|------|------|--------|
| 1 | Ingest and explore the full 4,200-student CSV data; co-create a teacher-annotated ground-truth subset; engineer behavioural features from response times, attempt trails, and correctness sequences; train baseline classifiers with a target recall ≥ 0.75 on held-out data. | A descriptive report on guessing behaviours, a novel feature set, a validated baseline classifier, and a small annotated dataset. |
| 2 | Design and train an HMM to model latent learning/guessing states over question-attempt sequences; compare HMM states to the ground truth and baseline classifiers; iteratively refine the model structure; build a prototype script that translates model output into interpretable teacher-facing flags. | A validated, comparative HMM for clickstream-state detection and a prototype flag-generation script. |
| 3 | Integrate the model into an offline, testable diagnostic tool; conduct a structured field trial in 3–5 classrooms in the first half of the 2025–26 school year; measure teacher agreement, tune alert thresholds, and prepare the methods and tool documentation for two journal publications. | A polished, teacher-tested diagnostic tool and two submitted journal papers. |

## What each side brings
- **Company:** Real-world, timestamped clickstream logs for ~4,200 students (C002-CH1); direct access to Vojvodina teachers and classrooms for annotation and field trials (C002-CH1); game-design and pedagogy expertise from Tatjana Kovačević; one day per week of Miroslav Kovačević's time for research collaboration (C002).
- **Faculty:** Supervisory and research expertise in HMM-based learning-state detection (SYN-PUB-10456), educational sequence clustering (SYN-PUB-10455), and competency prediction modelling (SYN-PUB-06872, SYN-PUB-10454); infrastructure for high-dimensional data analysis; access to MSc-level student interns for data engineering support (R1006).

## Why this pair
Zrenjanin Game Works holds a unique, large-scale primary-school clickstream dataset with a validated guessing problem but lacks internal analytics capacity. Prof. Mitrović has published precisely on the required methods, including "Applying Hidden Markov Models to Detect Shifts in Student Learning States from Clickstream Data" (SYN-PUB-10456), providing a direct academic foundation for a practical teacher tool that can be tested before the 2025–26 school year.

## Agreed up front
- Publication review window: 30 days.
- IP: The company owns the game platform, raw data, and the integrated diagnostic tool built on it. The Faculty retains ownership of generalisable models, methods, and open-source reference implementations.

## Risks
- Sufficient sequence density: if students play too infrequently, resulting click sequences may be too short or sparse for reliable HMM training and state discrimination.
- Ground-truth bottleneck: teachers may be unable or unwilling to conduct the paper-test verification required to annotate a high-quality training set, limiting supervised model calibration and HMM validation.

## Unverified evidence
- The exact volume, temporal resolution, and structure (unique vs. repeat students) of the full CSV export (C002-CH1).
- Teacher availability timeline for ground-truth annotation in Year 1 and field-trial participation in Year 3.
- Whether the game backend currently records item-level identifiers necessary for modelling question difficulty.

## Supervisors and candidate
- Academic supervisor: Prof. Dr. Danilo Mitrović, Assistant Professor, Department of Mathematics and Informatics, Faculty of Sciences, University of Novi Sad.
- Industrial supervisor: Miroslav Kovačević, Co-founder and Lead Developer, Zrenjanin Game Works d.o.o.
- Candidate profile: MSc in computer science, statistics, or data science with strong Python or R skills and coursework in machine learning and probabilistic models; experience with educational data or log-file analysis is a plus.

---

## 3. AutomVoj a.d. × Bojan Erić

- **Challenge:** C003-CH1
- **Fit:** 95%
- **Why:** Directly aligns on low-temperature fatigue and fracture of welded steel joints, with explicit willingness to test under combined loading — precisely the failure mode analysis needed.
- **Proposal:** `P-C003-CH1-R0365`

## The problem
AutomVoj a.d. has been replacing welded mild-steel conveyor frames under warranty because crossmember-to-stringer fillet welds crack after approximately 18 months in cold stores operating between 2 °C and 6 °C. Fourteen complete assemblies have been replaced this year alone C003-CH1. The company cannot reproduce the failure in its workshop because all load tests are conducted at room temperature, and it suspects that thermal cycling, condensation and belt vibration act together to drive a damage mechanism that ambient testing misses C003-CH1.

## Research questions
1. What is the dominant damage mechanism that drives crack initiation in the mild-steel crossmember-to-stringer fillet welds when subjected to the combined effect of sustained vibration, condensation-driven corrosion, and thermal cycling between 2 °C and ambient?
2. Which combination of weld geometry, filler material or post-weld treatment can reliably extend the crack-initiation life beyond a five-year continuous cold-store duty, verified by a low-temperature block-loading fatigue test?

## Plan
| Year | Work | Result |
|------|------|--------|
| 1 | Characterise as-built welds (macro-sections, residual stress via XRD), run 5 constant-amplitude fatigue tests at +2 °C with condensing humidity, build and calibrate a full-frame Abaqus FE model with DIC. | Validated FE model (strain within 15 %); quantified residual stress map; S–N data point from ≥ 5 valid specimens. |
| 2 | Capture vibration service logs, design a block-loading spectrum, test three improved joint variants inside the climate chamber at +2 °C under condensing conditions, parametrise NASGRO crack-growth model. | Ranked countermeasure variants; one variant selected that shows ≥ 3× fatigue life extension in the block-spectrum test. |
| 3 | Build two full conveyor-frame modules with the winning joint, perform a six-month accelerated durability test (−5 °C to +25 °C daily cycles), draft a revised welding procedure specification. | Validated inspection interval; approved WPS; thesis submitted. |

## What each side brings
- **Company:** Access to the Zrenjanin fabrication shop, two failed frame assemblies in storage, field vibration measurements, and the practical commissioning experience of 212 staff C003. Direct funding for a three-year PhD candidate, consumables, and test-frame fabrication.
- **Faculty:** A servo-hydraulic fatigue machine with a climate chamber to −60 °C, a 3D DIC system (Aramis), Abaqus FE licences, and protocols for low-temperature fatigue testing on welded structural steel R0365.

## Why this pair
AutomVoj needs to stop a recurring weld-cracking failure that only appears in cold, vibrating service — a failure they cannot replicate in their workshop. Bojan Erić’s group has just published **“Low-Cycle Fatigue Behaviour of Cruciform Welded Joints at −40 °C: An Experimental Study”** SYN-PUB-04474 and “Interaction of Mechanical Cyclic Loading and Thermal Cycling on Fatigue Life of Butt-Welded Structural Steel Plates” SYN-PUB-04475, which together demonstrate that his lab already runs precisely the low-temperature cyclic tests with DIC instrumentation that the company lacks. No other regional faculty combines a climate chamber to −60 °C, a servo-hydraulic rig, and a decade of fracture-mechanics modelling on welded steel grades. For the company, this is the fastest path to a weld procedure that survives a cold-store warranty period; for the researcher, it is a direct industrial validation of laboratory methods on a real, high-consequence structure.

## Agreed up front
- Publication review window: 60 days (company may request an additional 90 days for patent filing).
- IP: Methods (FE protocols, DIC procedures, fatigue-life scripts) owned by the Faculty; physical test rigs, jigs and the final WPS owned by AutomVoj a.d.

## Risks
- The dominant crack driver may be pure corrosion fatigue from condensation freeze-thaw cycles, not mechanical vibration; the weld-geometry changes studied could therefore show no life improvement, delaying a fix by 18 months.

## Unverified evidence
- The claim that the researcher has an active collaboration with a Vojvodina-based metalworking company during crane girder monitoring could not be verified against a named dataset and is omitted from the evidence chain.
- Exact make, capacity and load-cell configuration of the servo-hydraulic machine, and the internal volume of the climate chamber, are not stated in the provided source; suitability for a full-frame test must be confirmed.

## Supervisors and candidate
- **Academic supervisor:** Assoc. Prof. Bojan Erić, Faculty of Technical Sciences, University of Novi Sad.
- **Industrial supervisor:** Chief Engineer (to be confirmed), AutomVoj a.d.
- **Candidate profile:** A mechanical or materials engineer with a strong MSc in solid mechanics or welding technology. Must be confident in operating servo-hydraulic test rigs and running Abaqus FE simulations. A candidate who can spend 70 % of their time in the AutomVoj workshop and test floor, and 30 % in the university climate-chamber and DIC lab will succeed. Hands-on experience with arc welding of structural steel is highly desirable.

---

## 4. OsiguroMi d.o.o. × Žarko Pejić

- **Challenge:** C004-CH1
- **Fit:** 95%
- **Why:** Expert in geostatistical interpolation and satellite precipitation downscaling for index insurance, directly addressing parcel-level rainfall estimation with multi-source data.
- **Proposal:** `P-C004-CH1-R0364`

## The problem
OsiguroMi’s parametric crop product triggers payouts when the nearest official meteorological station records rainfall below a contractual threshold, but the station can be up to 30 km away, leading to unjustified payouts or missed claims (C004-CH1). A spatial rainfall estimate that works at the field scale is needed without replacing the regulatory framework.

## Research questions
1. How can satellite precipitation estimates, dense private gauge networks, and official station data be fused to produce a daily 1 km rainfall grid that reduces basis risk relative to the nearest-station threshold alone?
2. What is the spatial transferability of bias-correction factors derived from a 140-point network to operational index insurance triggers across Vojvodina parcels?

## Plan
| Year | Work | Result |
|------|------|--------|
| 1 | Harmonise RHMZS, private network, and IMERG data. Cross-validate kriging variants and random forest against held-out stations. | Benchmark model with root-mean-square error for monthly rainfall below 15 mm at 10 held-back locations. |
| 2 | Build a 1 km multi-source grid and a parcel-level rainfall-deficit index. Retrospective testing on historical partner claims. | Candidate index ready for identical-twin testing against the operational trigger over two growing seasons of partner data. |
| 3 | Execute pre-agreed performance protocol; shadow-trigger integration in the API; regulatory documentation. | Production-ready API endpoint returning parcel-scale drought status, with measured false-payout improvement over the baseline. |

## What each side brings
- **Company:** OsiguroMi d.o.o.: access to the white-label API and B2B partner claims data for historical verification; knowledge of the regulatory constraints for parametric triggers; requirement for a result applicable within six to nine months (C004).
- **Faculty:** Spatial statistics and satellite downscaling expertise; access to the group’s dense gauge network for short deployment campaigns (R0364); existing validated IMERG-based kriging-with-external-drift workflow (SYN-PUB-04461).

## Why this pair
Žarko Pejić has directly addressed the core problem: his publication “Kriging with External Drift Using IMERG Precipitation as a Covariate for Sub-Monthly Rainfall Mapping at 1 km Resolution in Northern Serbia” (SYN-PUB-04461) demonstrates a working method for the region. Combined with his index-insurance design study (SYN-PUB-04462) and OsiguroMi’s need to move beyond the 30 km station gap (C004-CH1), the pair aligns a proven geostatistical toolkit with a live parametric product.

## Agreed up front
Publication review window: 45 days. IP: Company owns the final rain-fused grid product and the tuned trigger model; Faculty retains ownership of the underlying interpolation methodology and may publish it after review.

## Risks
- The private network’s 140 point locations may not be well distributed across the active underwriting area, preventing a robust bias correction.
- Partner claims data may be too sparse or noisy to confidently measure a reduction in basis risk within the project timeline.

## Unverified evidence
- The number and spatial density of the three private agrometeorological networks totalling 140 measurement points.
- The exact locations and availability timelines of the partner claims dataset for retrospective testing.

## Supervisors and candidate
Academic supervisor: Prof. dr Branislav Jovanović
Industrial supervisor: Milena Čabarkapa
Candidate profile: MSc or PhD candidate with a background in geostatistics, remote sensing, or hydrometeorology, ideally familiar with agricultural index insurance and the Pannonian climate.

---
