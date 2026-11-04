# Source register

Access/review date: 2026-10-31. Links are references, not bundled third-party text.
Local downloaded PDFs and text extracts under `backups/speaker-research-2026-10-31`
are research scratch, excluded from Git.
The wiki preserves short original notes and factual input data.

| ID | Primary source / locator | Access and use |
| --- | --- | --- |
| START | [wintermute: So you want to design your own speaker from scratch](https://www.diyaudio.com/community/threads/so-you-want-to-design-your-own-speaker-from-scratch.332688/) | Read both pages, including later replies and unfinished placeholders. Orientation, not an engineering standard. |
| C-FAQ | [Carmody: Why Proven Designs and Kits](https://sites.google.com/site/undefinition/diy-speaker-faqs/diy-faqs-provendesigns) | Read. Repairs START's obsolete URL, which omitted `/diy-speaker-faqs/`. |
| C-OS | [Carmody: Overnight Sensations](https://sites.google.com/site/undefinition/bookshelf-speakers/diy-overnightsensations) | Read design write-up; example of matched enclosure, driver, and crossover decisions. |
| Z-INDEX | [Zaph Audio](https://www.zaphaudio.com/) | Read index; representative design followed below. Not every indexed project read. |
| Z-SR71 | [Zaph: SR71](https://www.zaphaudio.com/SR71.html) | Read design, measured/modelled response discussion, placement, and options. |
| T-INDEX | [Gravesen project index](https://www.troelsgravesen.dk/Diy_Loudspeaker_Projects.htm) | Repeated timeout/502. Do not claim full index inspection. |
| T-TQWT | [Gravesen: TQWT/DTQWT mkIII](https://www.troelsgravesen.dk/DTQWT-mkIII.htm) | Direct fetch unreliable; indexed primary-page text read. Drawing-level reconstruction not attempted. |
| T-OLD | [Gravesen: original JA8008/TQWT PDF](https://www.troelsgravesen.dk/JA8008.pdf) | Indexed dimensions/design discussion inspected. Different revision from mkIII. |
| CC-TRI | [Campbell: TriTrix](https://www.speakerdesignworks.com/tritrix) | Current page establishes authorship; body no longer exposes the old detailed write-up. Old `/Tritrix_pg_3.html` unavailable. |
| PE-TRI | [Parts Express TriTrix kit](https://www.parts-express.com/TriTrix-MTM-TL-Speaker-Components-And-Cabinet-Kit-Pair-300-702) | Read product description/BOM/specification. Sales specification is not independent test evidence. |
| PE-MAN | [TriTrix kit manual](https://www.parts-express.com/pedocs/manuals/300-702--tritrix-mtm-tl-speaker-kit-assembly-manual.pdf) | Read; rendered pp.7,12 and visually inspected assembly/crossover. Two DC130BS-4 woofers in series per cabinet. |
| PE-CAB | [TriTrix enclosure manual](https://www.parts-express.com/pedocs/manuals/300-701--tritrix-mtm-tl-enclosure-assembly-manual.pdf) | Read. Assembly photos, not a complete dimensioned cutting plan. |
| SB-W | [WO24P-4 manufacturer datasheet, revision 2](https://sbacoustics.com/wp-content/uploads/2024/04/9.5in-SATORI-WO24P-4.pdf) | Read specifications and mechanical drawing. Used for excursion and mechanical envelope; not substituted for King's measured T/S set. |
| SB-T | [TW29R manufacturer](https://sbacoustics.com/product/satori-tw29r/) | Indexed primary specifications inspected; direct page timed out. Not installed as a coupled TL source. |
| MJK-S | [King: The Two-Year Transmission Line Speaker Design](http://quarter-wave.com/Project13/Satori_TL_Design_Documentation.pdf) | Full PDF downloaded over working HTTP host (74 PDF pages). Text inspected through design, tests, crossovers, conclusions, and attachments. Figs.6,8 and printed pp.38-40 rendered and visually inspected. Primary source for selected design. |
| MJK-A | [King: Anatomy of a Transmission Line](http://quarter-wave.com/TLs/TL_Anatomy.pdf) | Retrieved; theoretical explanation and conclusions inspected. |
| MJK-21 | [King: Classic TL Enclosure Alignments, 2021](http://quarter-wave.com/TLs/TL_Alignments.pdf) | Retrieved; method and conclusions inspected. Do not confuse with older tables below. |
| MJK-OLD | [King: older alignment tables](http://quarter-wave.com/TLs/Alignment_Tables.pdf) | Retrieved as historical reference; not used to size the chosen cabinet. |
| MJK-O | [King: Advanced Transmission Line Modeling Techniques, 2002](http://quarter-wave.com/TLs/Advanced_Models.pdf) | Retrieved; offset-source explanation inspected. |
| V-F | [VituixCAD features](https://kimmosaunisto.net/Software/Software.html) | Read. Crossover/directivity/diffraction workflow; enclosure list explicitly excludes TL/horn simulation. |
| V-M | [VituixCAD 3 manual](https://kimmosaunisto.net/Software/VituixCAD/VituixCAD_help_30.html) | General workflow/data organization inspected; consult relevant sections for future crossover work. |
| REW | [REW impedance measurement](https://www.roomeqwizard.com/help/help_en-GB/html/impedancemeasurement.html), [T/S extraction](https://www.roomeqwizard.com/help/help_en-GB/html/thielesmall.html) | Official measurement guidance inspected. |
| APP | Repository `docs/PHYSICS.md`, `docs/MCP.md`, `docs/SPATIAL-FIELD.md`; live `aegir://schema` | Local implementation authority. Describes what this solver does, not external physical validation. |

## Source handling

The `www.quarter-wave.com` HTTPS endpoint failed certificate/hostname checks in
the local downloader; the non-www HTTP endpoint returned valid PDFs without
disabling TLS verification. Keep that retrieval distinction. Do not infer that a
failed HTTPS fetch means the paper was read. No restricted MathCad worksheets or
third-party simulator implementation was obtained or copied.
