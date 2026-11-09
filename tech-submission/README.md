# Technical Submission Builder (sample)

A browser app that puts together the recurring **Technical Submission for client approval**
for street lighting projects. You upload the standard documents once and reuse them. For each
project you enter what changes (wattages, models, pole dimensions), tick the documents you
need, and get one PDF with numbered pages.

## Submission structure

| No. | Section | Source |
|-----|---------|--------|
| 1 | Cover page | Generated from project details in the layout of `MAIN COVER PAGE.docx` (or upload a custom cover) |
| – | Index | Generated, with page numbers |
| – | Schedule of materials | Generated from the luminaire and pole tables |
| 2 | LT Company Profile | Library / project upload |
| 3 | Lighting Design | Usually a project upload |
| 4.1 | TDS – LED Light Fittings | Library (matches the luminaire schedule) |
| 4.2 | TDS – Poles | Library (matches the pole schedule) |
| 4.3 | TDS – Cables | Library |
| 4.4 | TDS – HDPE Pipes | Library |
| 4.5 | GA Drawing – Feeder Pillar | Library / project upload |
| 4.6 | Bought Out Items | Library |
| 5 | LT Source Approvals | Library |
| 6 | LT Road Lighting Credentials | Library |

"LT" is the company short name from **Company settings**, so you can change it there.

## How to use

1. **Company settings**: enter the company name, logo and submission title.
2. **Document library**: upload standard PDFs, JPGs or PNGs and give each one a section and tags
   (e.g. `90W, ABC-90`). If a data sheet gets a new revision, use **Replace**, and every project that
   uses it picks up the new file.
3. **Projects → + New project** (or **Duplicate** a previous one):
   - fill in the project details (short name, location, reference no., submission no., revision, date)
   - fill in the **cover page**: the full project title (printed after "PROJECT:"), the heading
     (e.g. "LED STREETLIGHTING PROPOSAL"), and up to 4 parties, each with a role, name and logo
     (e.g. Concessionaire / Client / Independent Engineer). A live preview sits next to the form.
     Logos are remembered, so typing a party name used in an earlier project fills in its logo.
   - fill in the luminaire and pole schedules
   - for each section, use **Select from library** or **Upload for this project**. Library documents
     whose name or tags match a model or wattage in the schedule are labelled *matching*.
   - change the order with ↑ ↓. Use **To library** to keep a project file for later projects.
4. **Generate submission PDF**. The PDF gets a cover with a client approval box, an index, the
   schedule of materials, divider pages, all the documents, and a footer
   (`LT | ref no. | Sub. no. | Rev | Page x of y`) on every page.

## Cover page

The default cover follows the company template (`MAIN COVER PAGE.docx`):

- a page border
- a blue, bold, centred **PROJECT:** title that shrinks to fit long titles
- the underlined heading
- the parties in columns, each with its role, logo and name
- **SUBMITTED BY**, with the company logo (from Company settings) and the company name
- a document control line (doc. no., submission no., revision, date)

**Company settings → Cover page style** can switch to a simple cover instead: a details table with a
client approval box (Approved / Approved as noted / Revise and resubmit / Rejected).

## Where the data is kept

Everything stays in this browser (IndexedDB). Nothing is uploaded to a server. Use
**Company settings → Export backup** to save a backup file, and **Import backup** to restore it on
another computer.

## Run it

It is a static site. With GitHub Pages switched on for this repository it is at
`https://vinuphilipos-boop.github.io/Project/tech-submission/`. To run it locally:

```sh
python3 -m http.server 8000   # from the repository root
```

and open http://localhost:8000/tech-submission/.

PDF merging uses [pdf-lib](https://pdf-lib.js.org/) (MIT), which is included in `vendor/`, so the
app also works without internet access.

## Limits of this sample

- Only PDF, JPG and PNG files can be added. Save Word, Excel and DWG files as PDF first.
- Password-protected PDFs can come out blank. Upload unprotected copies.
- Data is per browser. Use backups to move it, or add a shared server later (see below).

## Possible next steps

- A shared server or database so the whole team uses one library
- Editable cover page and divider templates, and several company profiles or brands
- A transmittal letter, a compliance statement or deviation list, and a document register in Excel
- Automatic data sheet selection from the luminaire schedule
