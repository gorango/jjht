
## C001-CH1 — ArmaturaSec d.o.o.
sector: Cybersecurity
challenge: We need to detect unusual behaviour on Modbus and BACnet networks without labelled attack data — our clients have never been breached (or don't know it), so we have zero examples of malicious traffic and supervised classifiers are useless to us.
detail: Our ProtoSense module watches Modbus and BACnet traffic and is supposed to flag anything that looks wrong. The problem is that none of our clients has ever given us a packet capture that contains a confirmed attack. A few of them have been running their networks for twenty years with no security mon
  1. R1008 Krisztina Kiss — Industrial cybersecurity; Network traffic analysis
     kw: anomaly detection, one-class classification, industrial control systems, SCADA security, statistical baseline modelling, Modbus
     open: joint projects with companies deploying ICS monitoring solutions
     shared: modbus, networks, data, traffic, capture, security, monitoring, ics
  2. R0233 Valentina Stojanović — Software Engineering and Testing; Embedded Systems
     kw: model-based testing, mutation testing, embedded firmware, automated regression testing, formal specification, test case generation
     open: joint projects with companies developing or testing embedded firmware
     shared: datasets, real, hardware, embedded, firmware, test, loop, testing
  3. R0356 Darko Ninkov — Mechatronics and Embedded Systems; Automotive Electronics and ECU Testing
     kw: hardware-in-the-loop, ECU validation, FPGA I/O emulation, real-time simulation, open-source real-time target, CAN bus
     open: contract research on ECU test bench development
     shared: real, hardware, months, embedded, linux, test, loop, bench
  4. R0071 Olivera Rakić — Machine Learning and Data Mining; Signal and Time-Series Analysis
     kw: anomaly detection, imbalanced learning, semi-supervised classification, concept drift, time-series, high-dimensional data
     open: joint projects with companies on anomaly detection in industrial sensor data
     shared: labelled, data, supervised, monitoring, datasets, real, inference, anomaly
  5. R0255 Nenad Uzelac — Transportation Engineering; Traffic Flow Theory
     kw: cellular automata, microscopic traffic simulation, signalised intersections, car-following models, mixed traffic, autonomous vehicles
     open: joint projects with companies developing traffic simulation or signal control software
     shared: data, traffic, firmware, cellular, testing

## C008-CH1 — Elekron Sistemi a.d.
sector: IoT and electronics hardware
challenge: We are retrofitting legacy water and heat meters for three municipal clients in Bosnia and North Macedonia with our LoRaWAN collar device, but the received signal strength inside basement meter rooms is between -120 and -125 dBm, which is at the edge of our ga
detail: We are fitting our LoRaWAN collar device onto existing water and heat meters in basement plant rooms for three municipal clients — two in Bosnia and one in North Macedonia. The problem is signal. Measured RSSI inside these rooms runs between -120 and -125 dBm, right at the edge of what our gateways 
  1. R0308 Jovan Bogićević — Manufacturing Engineering; Structural and Computational Mechanics
     kw: springback prediction, sheet-metal forming, press-brake bending, finite element analysis, adaptive control, high-strength steel
     open: joint projects with sheet-metal fabricators and tooling manufacturers
     shared: three, strength, limited, cnc, press, brake, sheet, metal
  2. R0593 Đuro Simić — Manufacturing and Production Engineering; Welding Technology
     kw: MIG/MAG welding, spatter reduction, thin sheet welding, weld process optimisation, pre-weld surface preparation, electrostatic powder coating
     open: contract research on weld process qualification and parameter optimisation
     shared: contracts, mig, welding, sheet, powder, line, based, control
  3. R0246 Vuk Todić — Industrial Engineering; Energy Efficiency in Manufacturing
     kw: energy value-stream mapping, per-process energy monitoring, electric arc welding energy consumption, load profiling, discrete manufacturing, three-phase power measurement
     open: joint projects with companies on energy monitoring instrumentation or energy VSM implementation
     shared: three, per, limited, cost, specific, running, embedded, mig
  4. R0811 Branislava Janković — Wireless Communications; Low-Power Wide-Area Networks
     kw: LoRa, LoRaWAN, link budget, path-loss modelling, spreading factor, gateway placement
     open: joint projects with companies deploying LoRaWAN sensor networks
     shared: lorawan, gateway, spreading, factor, link, budget, building, low
  5. R0206 Vesna Knežević — Embedded Systems and IoT; Signal Processing
     kw: vibration signal compression, edge inference, adaptive sampling, microcontroller deployment, neural network quantisation, rotating machinery diagnostics
     open: joint projects with companies needing embedded condition monitoring solutions
     shared: signal, edge, existing, node, devices, network, embedded, firmware

## C015-CH1 — Kristal Voda preduzetnik
sector: Water quality testing and on-site treatment equipment for food industry
challenge: Three of our dairy clients have reported a sulphur smell in their process water after we installed new ion-exchange softeners; we've flushed and regenerated the resins but the problem reappears within two weeks and one client has threatened to cancel.
detail: About eight months ago we fitted three dairy clients with new ion-exchange softeners from a batch we sourced from a different supplier than usual. Within a few weeks all three reported a sulphur or rotten-egg smell in their process water. We flushed the resin beds thoroughly and ran full regeneratio
  1. R0799 Danilo Vulin — Environmental Microbiology; Water Treatment Technology
     kw: cation exchange resins, sulphonate functional groups, hydrogen sulphide, anaerobic biofilm, sulphate-reducing bacteria, intermittent flow
     open: contract research on biofouling diagnosis and control in water treatment systems
     shared: sulphur, water, ion, exchange, resins, resin, cycles, sulphate
  2. R0824 Nenad Pavlović — Materials Science and Engineering; Corrosion Science and Electrochemistry
     kw: microbiologically influenced corrosion, austenitic stainless steel, electrochemical impedance spectroscopy, pitting corrosion, sulphate-reducing bacteria, passive film
     open: joint projects with water treatment or water infrastructure companies
     shared: water, sulphate, reducing, bacteria, contract, microbiologically, testing, treatment
  3. R0224 Ondrej Hriešik — Chemical Engineering; Water Treatment and Process Engineering
     kw: process simulation, water treatment, mass-balance optimisation, reverse osmosis, dynamic modelling, sedimentation
     open: joint projects with companies requiring process simulation or water circuit optimisation
     shared: process, water, ion, exchange, novi, contract, autumn, treatment
  4. R0405 Danica Ljubojević — Food Science and Technology; Microbiology and Food Safety
     kw: thermal inactivation kinetics, spore-forming bacteria, ohmic heating, Bacillus cereus, plant-based food, Weibull model
     open: contract research on thermal process validation for plant-based food products
     shared: process, weeks, bacteria, per, contract, quality, equipment, food
  5. R0954 Jasna Ljubojević — Microbial Ecology; Environmental Microbiology
     kw: drinking water distribution systems, biofilm communities, metagenomics, nitrification, iron oxidation, chloramine disinfection
     open: joint research projects with water utilities on microbiological monitoring
     shared: water, contract, disinfection, quality, treatment, equipment

## C022-CH1 — Njivomer Agro d.o.o.
sector: Agri-tech (farm software, sensing, drones)
challenge: When we import parcel boundaries from the state cadaster they frequently have 2–4 metre positional errors, which means our variable-rate application layers do not line up with the physical field edges and clients get under- or over-application strips along hea
detail: When we pull parcel boundaries from the state cadaster through their web service, the coordinates we receive are often shifted by two to four metres relative to where the field edges actually sit on a satellite image or on the ground. That gap might sound small, but when we build a variable-rate app
  1. R0680 Đuro Đorđević — Agronomy and Crop Science; Precision Agriculture
     kw: variable-rate application, nutrient prescription maps, soil spatial variability, yield response functions, crop protection modelling, geostatistics
     open: joint projects with agri-tech companies developing variable-rate application hardware or farm management software
     shared: variable, rate, application, field, under, farm, build, prescription
  2. R0450 Radomir Žarković — Agronomy and crop science; Soil biology and biochemistry
     kw: cover crop mixtures, nitrogen mineralisation, soil biological activity, cash crop establishment, carbon-to-nitrogen ratio, soil microbial biomass
     open: joint projects on cover crop systems and soil health
     shared: field, over, about, nitrogen, crop, season, data, soil
  3. R0964 Ljiljana Todić — Precision Agriculture; Remote and Proximal Sensing
     kw: active optical sensors, canopy reflectance, nitrogen status estimation, sensor fusion, prescription maps, NDRE
     open: joint projects with agri-tech companies developing or validating AOS hardware
     shared: variable, rate, application, field, ground, nitrogen, prescription, real
  4. R0971 Katarina Đorđević — Geodesy and Geoinformatics; Spatial Data Infrastructure
     kw: geospatial data integration, cadastral harmonisation, topological consistency, coordinate reference systems, spatial database management, INSPIRE directive
     open: joint projects with companies working on spatial data management, land information systems, or infrastructure asset management
     shared: reference, gnss, surveying, postgis, spatial, data, processing, database
  5. R0150 Mihajlo Kovačević — Geodesy and Geomatics; Satellite Navigation and Positioning
     kw: datum transformation, ETRS89, GNSS baseline processing, residual distortion, Helmert transformation, cadastral geodesy
     open: contract research on cadastral coordinate system harmonisation
     shared: field, satellite, reference, correction, region, gnss, receivers, spatial

## C029-CH1 — EkoGradnja Sistem a.d.
sector: Sustainable construction materials and prefabricated building systems
challenge: We introduced hemp-fibre insulation cores into our wall panels two years ago, but some batches absorb moisture during storage and the thermal resistance drops by up to 30 percent before the panels ever reach a construction site; we cannot predict which batches
detail: Two years ago we switched from mineral wool cores to hemp-fibre batts because the carbon numbers looked better and customers were asking about it. For about sixty percent of batches it works fine — the panels leave the factory with thermal resistance values that match our datasheet. But the other fo
  1. R0821 Ksenija Stojanović — Materials Engineering; Building Physics
     kw: natural fibre composites, hygrothermal properties, moisture sorption isotherms, vapour diffusion resistance, bio-based insulation, hemp-lime
     open: joint projects with companies testing hygrothermal properties of their building products
     shared: hemp, fibre, insulation, moisture, thermal, resistance, construction, testing
  2. R0809 Vera Zorić — Structural and Construction Engineering; Materials Science and Characterisation
     kw: recycled aggregate concrete, compressive strength variability, interfacial transition zone, chloride ingress, probabilistic modelling, precast concrete elements
     open: joint projects with precast concrete manufacturers
     shared: construction, real, concrete, production, recycled, aggregate, compressive, strength
  3. R0715 Bojan Grbić — Polymer Science and Engineering; Food and Industrial Packaging Technology
     kw: heat-sealable films, metallocene polyolefins, seal-layer formulation, VFFS packaging, thermal processing window, rheological characterisation
     open: contract research on seal-layer formulation and optimisation
     shared: thermal, cannot, film, temperature, seal, cast, production, processing
  4. R0089 Gordana Perišić — Building Physics and Energy Efficiency; Heat Transfer and Thermodynamics
     kw: natural convection, radiation heat transfer, phase-change materials, building envelope, ventilated façade, thermal energy storage
     open: contract research on experimental thermal characterisation of building products and assemblies
     shared: storage, thermal, construction, change, testing, measurement, heat, based
  5. R0794 Ildikó Szabó — Thermal Energy Systems; Geothermal Energy
     kw: geothermal heat pump, borehole heat exchanger, transient thermal modelling, ground temperature drift, seasonal COP degradation, shallow geothermal energy
     open: joint projects with companies designing or installing ground-source heat pump systems
     shared: thermal, about, other, test, temperature, concrete, heat, design

## C036-CH1 — FreshPak Solutions
sector: Packaging
challenge: Raspberries for Germany arrive with mould on day 9; buyers want 14 days.
detail: We ship raspberries from Serbian packing houses to buyers in Germany and the Netherlands. The berries leave Serbia in good condition — our own quality checks confirm that — but by day nine of a typical fourteen-day shelf-life window, a meaningful share of punnets show visible Botrytis mould. Buyers 
  1. R0715 Bojan Grbić — Polymer Science and Engineering; Food and Industrial Packaging Technology
     kw: heat-sealable films, metallocene polyolefins, seal-layer formulation, VFFS packaging, thermal processing window, rheological characterisation
     open: contract research on seal-layer formulation and optimisation
     shared: window, suppliers, heat, film, seal, temperature, limited, cannot
  2. R0172 Snežana Puzović — Polymer Science and Engineering; Packaging Materials
     kw: polyolefin multilayer films, gas permeability, barrier packaging, EVOH-free systems, oxygen transmission rate, water vapour permeability
     open: contract research on film barrier characterisation
     shared: film, oxygen, transmission, rate, otr, gas, temperature, materials
  3. R1044 Branka Lalić — Chemical and Polymer Engineering; Food and Biobased Materials
     kw: reactive extrusion, starch–protein blends, biodegradable packaging, in-line rheometry, gelatinisation, thermoplastic starch
     open: contract research on biopolymer packaging formulation and testing
     shared: leave, life, before, months, specification, materials, external, testing
  4. R0976 Jelena Marković — food engineering; packaging
     kw: shelf life, modified atmosphere packaging, berries, cold chain, predictive models
     open: industrial PhD supervision
     shared: berries, shelf, life, modified, atmosphere, packaging
  5. R0830 Jasna Nedić — Thermal and Process Engineering; Computational Fluid Dynamics
     kw: plate heat exchanger, two-phase flow, refrigerant maldistribution, fouling resistance, numerical modelling, CFD
     open: joint projects with companies operating plate heat exchangers in industrial cooling, heating, or heat pump applications
     shared: before, heat, condensation, modelling, real, data, simulation, validation

## C043-CH1 — KartografTech preduzetnik
sector: Automotive and mobility software
challenge: We update our road geometry database by driving survey vehicles ourselves; one full national pass takes four months and costs us around €60,000, which means our maps can be a year out of date when clients use them — new roundabouts and road closures are missin
detail: Ceo proces ažuriranja mape počiva na tome da naša dva vozila prođu svakim relevantnim putem u Srbiji – to je oko 18.000 kilometara razvrstanih puteva. Jedan kompletan prolaz traje četiri meseca i košta nas oko 60.000 evra samo u gorivom, platama vozača i amortizaciji opreme. Do trenutka kada klijent
  1. R0512 Radmila Radović — Geographic Information Systems and Spatial Data Processing; Autonomous and Assisted Driving Systems
     kw: road network topology, OpenDRIVE, ADAS simulation, intersection modelling, map format translation, geometric consistency
     open: joint projects with companies needing road map processing or simulation environment setup
     shared: road, driving, format, opendrive, software
  2. R0669 Tatjana Vučković — Saobraćajno inženjerstvo; Bezbednost puteva
     kw: horizontalne krivine, operativna brzina, konzistentnost geometrijskog projektovanja, dvotračni ruralni putevi, naturalističko posmatranje brzina, profil operativne brzine
     open: contract research – operating speed field measurement campaigns
     shared: road, puteva, ili, promene
  3. R0481 Ognjen Paunović — Remote Sensing and Photogrammetry; Geospatial Data Processing
     kw: change detection, LiDAR, UAV remote sensing, satellite imagery, road infrastructure mapping, high-definition maps
     open: joint projects with companies requiring road asset surveying or map update workflows
     shared: update, road, maps, lidar
  4. R0150 Mihajlo Kovačević — Geodesy and Geomatics; Satellite Navigation and Positioning
     kw: datum transformation, ETRS89, GNSS baseline processing, residual distortion, Helmert transformation, cadastral geodesy
     open: contract research on cadastral coordinate system harmonisation
     shared: national, year, navigation, gnss
  5. R0694 Radovan Radulović — Računarstvo i informatika; Formalne metode i verifikacija sistema
     kw: Petri mreže, rudarenje procesa, provjera usklađenosti, modelovanje toka rada, evidencije događaja, conformance checking
     open: joint projects with companies processing document-heavy administrative workflows
     shared: zbog, toka, ili, sistemi, podataka

## C050-CH1 — MojaKutija Commerce d.o.o.
sector: Logistics, transport and e-commerce
challenge: We pack between 600 and 2,200 parcels per day depending on campaigns; the swing is hard to predict so we either overstaff or rush. If we could forecast daily order volume five days ahead with reasonable accuracy we could plan temporary labour and packaging mat
detail: Our parcel volume swings between 600 and 2,200 boxes in a single day, mostly driven by campaign emails our clients send without always telling us in advance. We currently plan the next day's staffing by looking at the last three days and making a gut call. That works well enough in a flat week, but 
  1. R0805 Stefan Dimitrijević — Industrial Engineering; Cost Engineering and Management
     kw: parametric cost estimation, engineer-to-order manufacturing, work content standardisation, work measurement, cost-to-complete modelling, analogical estimation
     open: joint research projects with manufacturing companies on cost data analysis and model development
     shared: order, volume, cost, shared, time, management, system, planning
  2. R0780 Gordana Lekić — Transportation Engineering and Logistics; Operations Research and Combinatorial Optimisation
     kw: dynamic vehicle routing problem, rolling-horizon replanning, multi-depot fleet assignment, real-time demand perturbations, adaptive large neighbourhood search, last-mile logistics
     open: joint projects with companies operating urban or regional delivery fleets
     shared: currently, about, last, dispatch, time, system, planning, logistics
  3. R0867 Róbert Halász — Transport Engineering; Logistics and Freight Operations
     kw: drivers' hours regulations, tachograph data analysis, road freight compliance, algorithmic enforcement, working time directive, violation detection
     open: contract research on tachograph data processing and compliance auditing
     shared: about, carrier, constraint, hours, time, management, system, logistics
  4. R0172 Snežana Puzović — Polymer Science and Engineering; Packaging Materials
     kw: polyolefin multilayer films, gas permeability, barrier packaging, EVOH-free systems, oxygen transmission rate, water vapour permeability
     open: contract research on film barrier characterisation
     shared: packaging, material, currently, materials, transport
  5. R0916 Mihajlo Jakovljević — Transport Engineering and Planning; Freight and Logistics
     kw: freight mode choice, inland waterway transport, discrete choice experiment, shipper survey, Danube corridor, mixed logit
     open: joint projects on freight transport modelling or multimodal logistics
     shared: about, records, management, planning, logistics, transport

## C057-CH1 — AgroLens d.o.o.
sector: Agri-tech software
challenge: Farmers want a yield estimate per parcel by mid-June, but our maps only show crop vigour.
detail: Our crop health maps are genuinely useful for spotting stress or uneven emergence, but by late May every season our customers start asking the same question: how many tonnes per hectare should I expect on parcel 14 by harvest? Right now we cannot answer that. We have NDVI and a red-edge chlorophyll 
  1. R0087 Dejan Lalić — Geographic Information Science; Spatial Databases and Data Engineering
     kw: spatial database optimisation, vector tiles, web GIS, cadastral data, PostGIS, tile pyramid
     open: contract research on spatial database performance tuning
     shared: mid, data, 2026, backend, postgis, spatial, web, cluster
  2. R0208 Branka Sredojević — Seed Science and Technology; Vegetable Crop Production
     kw: seed priming, hydropriming, osmopriming, solid matrix priming, germination uniformity, seedling vigour
     open: joint projects with seed treatment companies or vegetable seed producers
     shared: crop, vigour, emergence, season, seed, image
  3. R0680 Đuro Đorđević — Agronomy and Crop Science; Precision Agriculture
     kw: variable-rate application, nutrient prescription maps, soil spatial variability, yield response functions, crop protection modelling, geostatistics
     open: joint projects with agri-tech companies developing variable-rate application hardware or farm management software
     shared: yield, maps, crop, final, monitor, data, farm, modelling
  4. R0068 Branislav Lekić — Remote Sensing; Agricultural Informatics
     kw: Sentinel-2, crop yield prediction, time series analysis, precision agriculture, parcel-level mapping, vegetation indices
     open: joint projects
     shared: yield, parcel, crop, should, now, ndvi, data, 2026
  5. R0450 Radomir Žarković — Agronomy and crop science; Soil biology and biochemistry
     kw: cover crop mixtures, nitrogen mineralisation, soil biological activity, cash crop establishment, carbon-to-nitrogen ratio, soil microbial biomass
     open: joint projects on cover crop systems and soil health
     shared: crop, health, may, season, seed, about, data, agri

## C064-CH1 — Krenuti Digital d.o.o.
sector: Custom software and IT services for EU clients
challenge: Our platform generates executable workflow scripts from user-drawn diagrams, but users in logistics companies keep building loops that deadlock under real load — support tickets about frozen workflows went from 12 to 67 per month in six months.
detail: FlowDeck lets users draw diagrams that become running automations. The engine walks through steps and fires actions — send email, update shipment status, call a carrier API. The problem is that users keep building loops with no safe exit: a step that waits for a carrier confirmation can loop back to
  1. R0780 Gordana Lekić — Transportation Engineering and Logistics; Operations Research and Combinatorial Optimisation
     kw: dynamic vehicle routing problem, rolling-horizon replanning, multi-depot fleet assignment, real-time demand perturbations, adaptive large neighbourhood search, last-mile logistics
     open: joint projects with companies operating urban or regional delivery fleets
     shared: logistics, companies, real, load, about, problem, last, full
  2. R0318 Aleksa Lazić — Formal Methods and Verification; Concurrent and Distributed Systems
     kw: Petri nets, reachability analysis, model checking, deadlock freedom, workflow engines, concurrent processes
     open: joint projects with companies requiring formal verification of process automation software
     shared: workflow, companies, deadlock, under, logs, starting, 2025, state
  3. R0571 Mirjana Malešević — Data Engineering; Software Quality Assurance
     kw: data quality monitoring, anomaly detection, schema drift, real-time data pipelines, API data integration, event-driven architecture
     open: joint projects with companies operating API-based data integrations
     shared: companies, real, load, api, handle, time, 2025, event
  4. R0937 Nataša Rajić — Industrial Engineering; Manufacturing Systems and Lean Production
     kw: value-stream mapping, precast concrete production, activity-based costing, bottleneck analysis, lean manufacturing, batch production
     open: contract research on production system analysis and cost modelling for manufacturing companies
     shared: companies, building, load, production, before, without, time, cycle
  5. R0802 Luka Knežević — Compiler Design and Code Generation; Computer Architecture
     kw: intermediate representation, register allocation, sparse tensor operations, domain-specific accelerators, LLVM, compiler back-end
     open: joint projects with companies developing custom silicon or FPGA accelerators
     shared: companies, under, back, graphs, end, custom, software

## C071-CH1 — Voltiko d.o.o.
sector: IoT and electronics hardware
challenge: Our sensor nodes run on coin-cell batteries and we promise 5-year lifetime, but field data from two Austrian clients shows 28% of units drop below threshold voltage before 30 months — we have no model that predicts which units will fail early so we can adjust 
detail: Our VN-4x nodes are sold with a five-year battery life guarantee under a defined duty cycle. We size the power budget carefully and the median unit in the field is fine, but last year two Austrian integrators — Brauer Systemtechnik and Feldergruppe — sent us field data showing that 28% of units from
  1. R0352 Bojana Mijatović — Quality Engineering and Statistical Process Control; Electronics Manufacturing and PCB Assembly
     kw: statistical process control, automated optical inspection, PCB assembly, small-batch manufacturing, solder paste inspection, control charts
     open: contract research on SPC implementation and AOI system evaluation
     shared: run, data, production, under, component, batch, statistical, machine
  2. R0826 Vuk Bačić — Electrical Engineering; Energy Storage and Power Electronics
     kw: primary lithium cells, pulsed-load discharge, electrochemical impedance spectroscopy, battery lifetime estimation, wireless sensor networks, low-power embedded systems
     open: joint projects with companies deploying battery-powered IoT or wireless sensor devices
     shared: sensor, cell, lifetime, data, model, early, battery, power
  3. R0905 Filip Mijatović — Microelectronics and mixed-signal circuit design; Wireless sensor networks and embedded systems
     kw: ultra-low-power design, body-area networks, mixed-signal CMOS, biopotential acquisition, duty-cycled MAC, energy harvesting
     open: joint projects with medical device companies
     shared: sensor, threshold, before, duty, power, about, sub, ultra
  4. R0811 Branislava Janković — Wireless Communications; Low-Power Wide-Area Networks
     kw: LoRa, LoRaWAN, link budget, path-loss modelling, spreading factor, gateway placement
     open: joint projects with companies deploying LoRaWAN sensor networks
     shared: sensor, year, field, data, power, budget, specific, sub
  5. R0962 Danilo Uzelac — Wireless Communications; Sensor Networks and IoT
     kw: sub-GHz propagation, vegetation canopy attenuation, LoRaWAN, LPWAN, MAC-layer protocols, path-loss modelling
     open: joint projects with companies deploying IoT sensor networks in agriculture, logistics, or utilities
     shared: sensor, field, power, budget, background, sub, ghz, firmware

## C078-CH1 — Aroma Natura a.d.
sector: Pharma, cosmetics and chemicals
challenge: Three of our best-selling moisturisers have a shelf life of only 14 months, which is too short for some German and Austrian distributors who need at least 24 months to cover their warehouse cycle. We've tried increasing the preservative load but it pushes us o
detail: Three of our moisturisers — the Intensive Lavender Night Cream, the Chamomile Daily Fluid and the Rose Hip Hand Barrier Cream — currently pass stability testing at 14 months but start showing signs of microbial and oxidative change before 24 months. Austrian and German distributors tell us they need
  1. R0391 Željko Zarić — Applied and Engineering Chemistry; Cosmetic Formulation Science
     kw: emulsion stability, antioxidant synergism, water activity, accelerated ageing, rheology, oxidative stability
     open: contract research on emulsion stability assessment and formulation optimisation
     shared: some, least, preservative, cosmetics, currently, stability, oxidative, antioxidant
  2. R0470 Slobodan Vulin — Food packaging science; Polymer chemistry
     kw: plasticiser migration, antioxidant additives, multilayer polymer films, fatty food simulants, migration kinetics, HPLC-DAD
     open: contract research on migration testing and compliance assessment for food-contact packaging materials
     shared: regulation, testing, allow, time, antioxidant, house, accelerated, real
  3. R0953 Marija Lazić — Environmental Engineering; Water Supply and Sanitation
     kw: quantitative microbial risk assessment, shallow alluvial wells, Cryptosporidium, Campylobacter, dose–response modelling, potable water
     open: joint project applications with water technology companies (treatment, monitoring, sensors)
     shared: currently, microbial, dose, water, systems, safety, assessment, under
  4. R0352 Bojana Mijatović — Quality Engineering and Statistical Process Control; Electronics Manufacturing and PCB Assembly
     kw: statistical process control, automated optical inspection, PCB assembly, small-batch manufacturing, solder paste inspection, control charts
     open: contract research on SPC implementation and AOI system evaluation
     shared: short, load, currently, run, real, control, systems, under
  5. R0661 Enikő Varga — Chemical Engineering; Essential Oil Technology
     kw: steam distillation, hydrodistillation, essential oils, volatile secondary metabolites, plant biomass, mass transfer
     open: contract research on distillation process optimisation for aromatic plant processors
     shared: secondary, steam, distillation, unit, essential, oil

## C085-CH1 — Labos Dijagnostika a.d.
sector: Biotech, diagnostics and lab services
challenge: We run 1,400 blood samples a day across three analysers and our middleware flags about 60 samples daily for manual technician review, but we estimate at least half of those reflex reviews are unnecessary — that alone costs us 2.5 extra technician-hours every s
detail: We run roughly 1,400 blood samples through our three analysers every working day. Our middleware is set up with a rule set that flags results outside certain delta-check and absolute-value thresholds, and on a typical day about 60 samples come back requiring a technician to physically look at the sl
  1. R0056 Nikola Bulatović — Veterinary microbiology; Antimicrobial resistance
     kw: Enterococcus faecalis, Enterococcus faecium, antimicrobial resistance, minimum inhibitory concentration, EUCAST, vancomycin resistance
     open: Contract research on AMR phenotyping and genotyping of bacterial isolates from veterinary or food-safety contexts
     shared: through, microbiology, antimicrobial, resistance, surveillance, based, biotech, diagnostics
  2. R0492 Ognjen Žarković — Accounting Information Systems; Business Informatics
     kw: accounting information system quality, managerial decision confidence, family-owned manufacturing firms, information quality dimensions, AIS adoption, decision-maker behavior
     open: joint research projects with companies using or developing ERP or cloud accounting software
     shared: data, decision, information, management, system, quality
  3. R0370 Ján Struhár — Industrial Engineering and Management; Supply Chain Management
     kw: supplier selection, supply chain resilience, fuzzy TOPSIS, multi-criteria decision making, geopolitical risk, single-source dependency
     open: joint research projects with companies on supplier evaluation and supply chain risk
     shared: data, decision, support, management, based, chain
  4. R0152 Marko Vasić — Information Systems; Business Process Management
     kw: business process automation, workflow engines, ERP systems, payroll processing, HR information systems, rule-based systems
     open: joint projects with companies developing or maintaining ERP or HRMS products
     shared: rule, decision, information, management, based, diagnostics
  5. R0595 Zuzana Kmeťová — Machine Learning and Data Mining; Biomedical Informatics
     kw: supervised classification, imbalanced classes, threshold optimisation, clinical decision support, multivariate clinical data, cost-sensitive learning
     open: joint projects with companies developing laboratory information systems or diagnostic software
     shared: working, threshold, data, decision, support, laboratory, information

## C092-CH1 — AxleWave Systems d.o.o.
sector: Automotive and mobility software
challenge: Our vibration sensor on the gearbox generates 4 kHz raw signals; we are currently sending everything to the cloud and the data bill is already €18,000 a month at only 200 trucks — we cannot scale to 2,000 trucks without compressing or filtering at the edge fir
detail: Right now every sensor node streams raw 4 kHz accelerometer data straight to AWS. At 200 trucks that costs us roughly €18,000 a month just in ingestion and storage. We have run the numbers and scaling to 2,000 trucks without changing the architecture would push that above €180,000 a month, which kil
  1. R0822 Vladana Radić — Condition Monitoring and Predictive Maintenance; Signal Processing and Time-Series Analysis
     kw: predictive maintenance, vibration analysis, thermal signatures, rotating machinery, remaining useful life, fault prognosis
     open: joint projects with companies in process industries (pumps, compressors, conveyors)
     shared: vibration, sensor, gearbox, currently, data, signatures, predictive, before
  2. R0057 Lazar Šarić — Signal Processing; Data Compression and Coding
     kw: signal compression, physiological time series, quasi-periodic redundancy, entropy coding, ECG compression, wavelet transform
     open: joint projects on embedded or real-time biomedical signal compression
     shared: data, science, device, representation, near, compression, processing, signal
  3. R0737 Gordana Kuzmanović — Mechanical Engineering; Condition Monitoring and Fault Diagnostics
     kw: vibration analysis, rotating machinery, bearing fault diagnosis, gear fault detection, frequency-domain feature extraction, physics-informed machine learning
     open: joint projects with companies developing condition monitoring products or services
     shared: vibration, sensor, data, based, bearing, fault, processing, signal
  4. R0706 Predrag Cvetković — Structural Engineering; Structural Health Monitoring
     kw: structural health monitoring, reinforced concrete bridges, ambient vibration testing, output-only modal analysis, damage-sensitive features, temperature compensation
     open: joint projects with companies developing sensor hardware or data acquisition systems for infrastructure
     shared: vibration, sensor, data, only, edge, low, work, transmission
  5. R0206 Vesna Knežević — Embedded Systems and IoT; Signal Processing
     kw: vibration signal compression, edge inference, adaptive sampling, microcontroller deployment, neural network quantisation, rotating machinery diagnostics
     open: joint projects with companies needing embedded condition monitoring solutions
     shared: vibration, sensor, currently, data, edge, node, based, work

## C099-CH1 — Datavox Consulting d.o.o.
sector: AI and data consultancies
challenge: Our churn-prediction model for a telecom client tops out at 71% recall, and every percentage point we miss costs the client roughly €180,000 in lost revenue per quarter — we've tried XGBoost and basic neural nets but we're stuck.
detail: We have been running a churn-prediction model for a telecom client for about fourteen months. The model flags subscribers likely to cancel within the next 30 days so the client's retention team can call them first. Right now we are hitting 71% recall on the holdout set, and the client has worked out
  1. R0228 Dunja Simić — Business Informatics; Customer Analytics
     kw: customer lifetime value, churn prediction, survival analysis, B2B SaaS, subscription services, longitudinal data
     open: joint projects
     shared: churn, prediction, retention, customer, data, business
  2. R0571 Mirjana Malešević — Data Engineering; Software Quality Assurance
     kw: data quality monitoring, anomaly detection, schema drift, real-time data pipelines, API data integration, event-driven architecture
     open: joint projects with companies operating API-based data integrations
     shared: engineering, real, data, anonymised, business, pipeline, api, based
  3. R0559 Sara Despotović — Machine Learning; Data Engineering
     kw: class imbalance, ensemble methods, tabular data, feature engineering, time-series logs, oversampling
     open: joint projects with companies generating operational or transactional logs
     shared: prediction, model, feature, engineering, subscriber, class, imbalance, real
  4. R1020 Predrag Nedić — Distributed Systems; Data Engineering
     kw: stream processing, distributed join algorithms, real-time data reconciliation, Apache Flink, cloud-native infrastructure, latency optimisation
     open: joint research projects with companies processing high-volume event or sensor data
     shared: per, engineering, real, data, work, anonymised, apache, pipeline
  5. R0961 Nina Despotović — Machine Learning and Deep Learning; Medical Image Analysis
     kw: generative adversarial networks, data augmentation, class imbalance, histopathology image classification, synthetic minority oversampling, convolutional neural networks
     open: joint projects with medical imaging or digital pathology companies
     shared: model, neural, engineering, class, imbalance, real, data, work

## C106-CH1 — Datakor Consulting d.o.o.
sector: AI and data consultancies
challenge: Our clients in the automotive supply chain generate time-series sensor logs at 10 ms intervals from assembly lines, and our current anomaly-detection pipeline flags roughly 22% false positives per shift, which means floor managers have started ignoring the ale
detail: Radimo s nekoliko klijenata u automobilskom dobavnom lancu čije montažne linije šalju senzorske logove svakih 10 milisekundi. To je ogroman obim podataka, i naš trenutni sistem za detekciju anomalija — zasnovan na statičkim pragovima i jednostavnim z-score pravilima — generiše oko 22% lažnih uzbuna 
  1. R0571 Mirjana Malešević — Data Engineering; Software Quality Assurance
     kw: data quality monitoring, anomaly detection, schema drift, real-time data pipelines, API data integration, event-driven architecture
     open: joint projects with companies operating API-based data integrations
     shared: time, current, anomaly, detection, pipeline, real, drift, streaming
  2. R0634 Vladimir Pejić — Machine Learning and Data Mining; Precision Agriculture and Agricultural Engineering
     kw: anomaly detection, multivariate time-series, change-point detection, drift detection, predictive maintenance, embedded sensor telemetry
     open: joint projects with companies developing or deploying agricultural telematics hardware or fleet management software
     shared: time, series, sensor, anomaly, detection, roughly, per, drift
  3. R0030 Vladana Vojnović — Machine Learning and Data Mining; Distributed Systems and Infrastructure Monitoring
     kw: anomaly detection, log analysis, unsupervised learning, event correlation, high-velocity data streams, clustering
     open: joint projects with companies generating high-volume operational or security logs
     shared: time, series, logs, anomaly, detection, pipeline, real, apache
  4. R0071 Olivera Rakić — Machine Learning and Data Mining; Signal and Time-Series Analysis
     kw: anomaly detection, imbalanced learning, semi-supervised classification, concept drift, time-series, high-dimensional data
     open: joint projects with companies on anomaly detection in industrial sensor data
     shared: time, series, sensor, anomaly, detection, real, drift, data
  5. R0370 Ján Struhár — Industrial Engineering and Management; Supply Chain Management
     kw: supplier selection, supply chain resilience, fuzzy TOPSIS, multi-criteria decision making, geopolitical risk, single-source dependency
     open: joint research projects with companies on supplier evaluation and supply chain risk
     shared: automotive, supply, chain, real, data

## C113-CH1 — Voltex Solutions d.o.o.
sector: Custom software and IT services for EU clients
challenge: Our ERP connectors break every time a German client upgrades their SAP instance — we spend roughly 600 developer-hours a year on reactive patches instead of new features, and three clients have already threatened to leave.
detail: Svaki put kada neki od naših nemačkih klijenata nadogradi SAP instancu — a to rade otprilike dva puta godišnje — naši konektori prestanu da rade kako treba. Greške se pojavljuju na nivoima mapiranja podataka i autentifikacije, i svaki put moramo da šaljemo jednog ili dvojicu inženjera da ručno anali
  1. R0028 Olivera Kuzmanović — Telecommunications and Networking; Multimedia Systems
     kw: adaptive bitrate streaming, WebRTC, media server orchestration, DASH, HLS, network emulation
     open: joint projects with companies developing video conferencing or live streaming products
     shared: time, server, streaming, software
  2. R0030 Vladana Vojnović — Machine Learning and Data Mining; Distributed Systems and Infrastructure Monitoring
     kw: anomaly detection, log analysis, unsupervised learning, event correlation, high-velocity data streams, clustering
     open: joint projects with companies generating high-volume operational or security logs
     shared: time, three, apache, kafka, event
  3. R0694 Radovan Radulović — Računarstvo i informatika; Formalne metode i verifikacija sistema
     kw: Petri mreže, rudarenje procesa, provjera usklađenosti, modelovanje toka rada, evidencije događaja, conformance checking
     open: joint projects with companies processing document-heavy administrative workflows
     shared: erp, podataka, ili, rada, koje, event
  4. R1020 Predrag Nedić — Distributed Systems; Data Engineering
     kw: stream processing, distributed join algorithms, real-time data reconciliation, Apache Flink, cloud-native infrastructure, latency optimisation
     open: joint research projects with companies processing high-volume event or sensor data
     shared: time, apache, kafka, event
  5. R0237 Radomir Janković — Multimedia Communications; Wireless Networking
     kw: adaptive bitrate streaming, 360-degree video, quality of experience, viewport prediction, heterogeneous wireless networks, equirectangular projection
     open: joint projects with companies developing video streaming platforms or CDN infrastructure
     shared: streaming

## C120-CH1 — Analitika Petrović preduzetnik
sector: AI and data consultancies
challenge: One of our agri-food clients collects temperature, humidity and CO₂ readings every five minutes across 22 storage silos, but the time-series database is growing at 40 GB per month and our queries for monthly reports already take 45 minutes — we can't afford cl
detail: Jedan naš klijent, prerađivač voća i povrća, ima 22 silosa u kojima senzori mere temperaturu, vlažnost i CO₂ svakih pet minuta, cele godine. Koristimo TimescaleDB na njihovom lokalnom serveru — mašina sa 32 GB RAM-a i 4 TB diska koji je već popunjen skoro do pola. Baza raste oko 40 GB mesečno i sada
  1. R0217 Andrea Malešević — Distributed Systems and Databases; Algorithms and Data Structures
     kw: distributed database optimisation, OCSP query resolution, scalable data structures, certificate status protocol, high-throughput systems, B-tree variants
     open: joint projects with companies developing PKI or certificate management infrastructure
     shared: time, database, ima, godine, sto, tokom, nije, query
  2. R0019 Petar Hadžić — Databases and Data Management; Data Compression
     kw: time-series compression, columnar storage, in-database aggregation, sensor data, query optimisation, delta encoding
     open: contract research on time-series storage and query optimisation
     shared: storage, time, series, database, query, data
  3. R0252 Gordana Radić — Food Science and Technology; Food Engineering
     kw: water activity, glass transition, moisture sorption isotherms, intermediate-moisture foods, dried fruit, confectionery
     open: contract research on moisture sorption and glass transition characterisation for food industry clients
     shared: food, clients, humidity, storage, koji, mesecno, nije
  4. R0017 Željko Đukić — Nuclear Medicine and Molecular Imaging; Oncological Radiology
     kw: PET kinetic modelling, 18F-FDG PET/CT, musculoskeletal tumours, treatment response assessment, compartmental modelling, parametric imaging
     open: joint projects with companies developing medical image analysis software or AI-based diagnostics tools
     shared: time, pet
  5. R0935 Natalija Despotović — Operations Research and Management Science; Supply Chain Management
     kw: multi-criteria decision-making, supplier selection, agri-food supply chains, fuzzy sets, grey systems, supply chain risk
     open: joint projects with agri-food companies on supplier evaluation and procurement optimisation
     shared: agri, food, time, already, novi, data

## C127-CH1 — Prosveta Digital preduzetnik
sector: Edtech
challenge: We designed our game mechanics intuitively, but we have no evidence they actually build mathematical reasoning skills — two schools tried the kits last year and the teachers said the kids had fun but their test scores didn't noticeably improve, and we need rea
detail: We built the game mechanics by instinct — Milena drew on her classroom experience and we iterated through maybe thirty playtesting sessions with children from our own networks before going to market. Last school year two primary schools in the Zrenjanin area each ran a six-week enrichment programme 
  1. R0837 Vukica Arsić — Educational Technology; Cognitive Development
     kw: game-based learning, mathematical cognition, late childhood, digital-physical hybrid, quasi-experimental design, arithmetic fluency
     open: joint projects on learning analytics for educational game platforms
     shared: game, mechanics, mathematical, experience, children, school, primary, arithmetic
  2. R0203 Snežana Crnković — Educational Technology; Teacher Education and Professional Development
     kw: teacher professional identity, mandated technology adoption, digital tools in primary schools, identity threat, reflective practice, technology acceptance
     open: joint projects on workplace digital adoption and employee identity
     shared: schools, teachers, before, her, primary, about, end, being
  3. R0872 Boris Krstić — Educational Technology; Family and School Relations
     kw: parental digital mediation, e-learning homework, primary school children, screen time, active mediation, restrictive mediation
     open: joint projects
     shared: children, networks, school, primary, clear, education
  4. R1004 Valentina Ninkov — Educational Psychology; Mathematics Education
     kw: cognitive load theory, working memory, early numeracy, multilingual classrooms, bilingual education, primary mathematics
     open: joint projects
     shared: her, classroom, experience, primary, cognitive, education, tracking
  5. R0265 Emilija Kapor — Speech and Language Technology; Signal Processing
     kw: automatic speech recognition, Serbian language, telephone speech, noisy channel ASR, acoustic modelling, Kaldi
     open: joint projects on speech technology for Serbian or regional languages
     shared: year, her, end, data, speech

## C134-CH1 — BuildTwin d.o.o.
sector: Construction consulting
challenge: Cities want to retrofit 40 schools but don't know which to do first for the biggest energy savings per dinar.
detail: One of our longest-standing municipal clients manages a portfolio of 40 school buildings across three municipalities. They have secured a multi-year retrofit budget from a regional development fund, but the fund requires them to submit a ranked list of buildings before the first contract is signed, 
  1. R0685 Milena Kecman — Building Physics and Energy Efficiency; Computational Fluid Dynamics
     kw: thermal comfort, natural ventilation, heritage school buildings, CFD simulation, building energy simulation, occupancy-driven control
     open: joint projects with companies developing building automation or sensor systems for public buildings
     shared: retrofit, energy, school, buildings, contract, data, quality, milena
  2. R0246 Vuk Todić — Industrial Engineering; Energy Efficiency in Manufacturing
     kw: energy value-stream mapping, per-process energy monitoring, electric arc welding energy consumption, load profiling, discrete manufacturing, three-phase power measurement
     open: joint projects with companies on energy monitoring instrumentation or energy VSM implementation
     shared: energy, per, three, contract, data, running, mapping, consulting
  3. R0873 Csaba Tóth — Energy Management and Efficiency; Industrial Engineering
     kw: energy performance contracts, measurement and verification, IPMVP Option C, baseline adjustment, regression analysis, uncertainty quantification
     open: contract research on measurement and verification methodology for industrial EPCs
     shared: energy, savings, development, requires, contract, data, building, months
  4. R0016 Ivona Matić — Energy Engineering; Industrial Process Engineering
     kw: energy audit, demand-side management, power quality, peak-demand tariff, load shifting, electrochemical manufacturing
     open: contract research: energy audits and demand-side management studies for manufacturing companies
     shared: energy, savings, fund, contract, reduction, quality, weeks, industry
  5. R0687 Radmila Jakovljević — Control Engineering and Automation; Building Energy Systems
     kw: grey-box modelling, nonlinear system identification, thermal comfort, state-space models, building energy performance, model predictive control
     open: joint projects with companies developing building automation or HVAC control products
     shared: energy, buildings, requires, contract, data, building, weeks, processing
