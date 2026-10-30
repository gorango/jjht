# Data and APIs — EINSTEIN track

Sources: the organizers' dataset repo, its `docs/apis.md`, and the dataset README vendored at
`data/README.md` (accessed 2026-10-30, with a size discrepancy noted below).

## The synthetic dataset

All of it is **invented**: people, companies, publications, projects and patents do not exist. The
faculties are real and set the scene only. Real public data is allowed as context.

The organizers' README is explicit about why it is large:

> About **7 million tokens** (32 MB): several times what fits in any model's context window. You
> can't paste it into one prompt and ask for the best pairs. Split the work: profile researchers,
> read companies, search, shortlist, check, write. **That is what the track is about.**

### Contents

| | Count |
| --- | --- |
| Researchers (16 faculties and institutes) | **1,047** |
| Publications (almost all with an abstract) | **10,779** |
| Projects | **1,823** |
| Patents | **111** |
| Companies | **153** |
| Company challenges | **489** |
| Company pages (website, job ads, news, blog, events) | **917** |

### Files

| File | What's in it |
| --- | --- |
| `data/researchers.json` | Profiles: title, faculty, department, fields, keywords, bio, ids of publications/projects/patents, `open_to`, industry experience, notes, `language` |
| `data/publications.jsonl` | One publication per line: title, abstract, year, venue, type, keywords, authors (with `researcher_id` where profiled) |
| `data/projects.json` | Programme, years, summary, partners, participants (`researcher_id`, role) |
| `data/patents.json` | Status, abstract, inventors |
| `data/companies.json` | Sector, size, what they do, products, tech, **challenges** (id, one-line `text`, longer `detail`), plans, R&D capacity, past collaborations |
| `data/company-pages.jsonl` | One page per line, by `company_id` |
| `data/researchers.csv`, `data/companies.csv` | Flattened for a spreadsheet (UTF-8) |

### Ids

Everything is citable: researchers `R0001`, companies `C001`, challenges `C001-CH1`, publications
`SYN-PUB-00001`, projects `SYN-PRJ-0001`, patents `SYN-PAT-001`.

### Why the data is dirty (intentionally)

- Some records are incomplete: no bio, a publication without an abstract, a profile with keywords only.
- A few people and companies write in **Serbian, in Latin or Cyrillic script**.
- **One person can appear in two sources under a different spelling**; two people can share a name.
- Profiles go stale: someone retired or left the university.
- Companies speak business language, researchers speak academic language; the same word can mean
  different things in different fields.
- **Some challenges have no good match at the university, and some aren't research problems at
  all. When that's the case, the right answer says so.**

### Rules the brief attaches to the data

- The system **proposes collaborations**; it does not score or rank people by their worth.
- A claim about a person (publication, skill, patent) must come from the data or a public source you
  cite.
- Only public data or the provided dataset.

## Public APIs

From `docs/apis.md` ("Checked on 28 October 2026"). Request keys early: some take a working day.

| Source | What you get | Key | Limits / notes |
| --- | --- | --- | --- |
| OpenAlex | Works, authors, institutions, topics, citations | Free key: <https://openalex.org/settings/api> | ~1,000 list calls/day without a key, 10× with one. Get a **key per team** — a shared IP runs out fast. |
| ORCID | Affiliations, works, funding as entered by the researcher | None for public reads | Be gentle: a few requests/second. Send `Accept: application/json`. |
| CORDIS | EU-funded projects and participants | None for search and bulk files | Bulk files are tens of MB. |
| EU Funding & Tenders | Open calls (for a Funding Scout) | Public `apiKey=SEDIA` | Search mixes calls with FAQ pages; filter on `type` and check `deadlineDate`. |
| Lens | Patents and scholarly works | Request access, then token | **Approval can take a working day.** |
| Espacenet OPS | European patents | Free registration | Weekly data quota. |

### Verified endpoints

University of Novi Sad is OpenAlex institution **`I170726198`**, ROR **`00xa57a59`**.

```sh
# Institution
curl "https://api.openalex.org/institutions/I170726198?api_key=$OPENALEX_KEY"

# Its works on a topic (works list authors; author search matches names, not topics)
curl "https://api.openalex.org/works?filter=institutions.id:I170726198&search=remote%20sensing&api_key=$OPENALEX_KEY"

# Its authors
curl "https://api.openalex.org/authors?filter=last_known_institutions.id:I170726198&api_key=$OPENALEX_KEY"

# ORCID: search, then read one record
curl -H "Accept: application/json" "https://pub.orcid.org/v3.0/expanded-search/?q=affiliation-org-name:%22University%20of%20Novi%20Sad%22%20AND%20keyword:hydrology&rows=10"

# CORDIS: search, or download all Horizon Europe projects (~35 MB)
curl "https://cordis.europa.eu/search?q=contenttype%3D%27project%27%20AND%20%27Novi%20Sad%27&p=1&num=10&srt=Relevance:decreasing&format=json"
curl -O "https://cordis.europa.eu/data/cordis-HORIZONprojects-json.zip"

# EU calls
curl -X POST "https://api.tech.ec.europa.eu/search-api/prod/rest/search?apiKey=SEDIA&text=irrigation&pageSize=10&pageNumber=1" \
  -F 'query={"bool":{"must":[{"terms":{"type":["1","2","8"]}}]}};type=application/json' \
  -F 'languages=["en"];type=application/json'
```

Serbia's Innovation Fund (<https://www.inovacionifond.rs>) has **no API**; calls are on the website.

### Good manners (the brief's words)

- **Cache what you fetch.** The same researcher shouldn't cost a call per agent.
- **Keep each fact's source** (a URL or an id) next to it, so a Critic can check it.
- **Real people are in these sources.** Propose collaborations; never score people.

## What the brief calls a good proposal

`docs/example-industrial-phd-topic.md` (vendored at `data/docs/`) is the shape they want. Its
sections are worth copying structurally:

- Company, faculty, **supervisors (academic + industrial)**, candidate
- The problem, with numbers
- **Research questions**
- **Year-by-year plan table**
- What each side brings
- Why this pair (and why neither side could do it alone)
- **"Agreed up front"** — publication review window, IP ownership

If a proposal omits supervisors, research questions, the year-by-year plan, or the agreed terms, it
is not the shape the organizers showed.
