import { NextResponse } from 'next/server';
import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer, Table, TableCell, TableRow, WidthType, BorderStyle, ImageRun, Header, TabStopPosition, TabStopType } from 'docx';
import { getBriefConfig } from '@/lib/questions';
import { getAgencyBriefConfig } from '@/lib/questions/agency';
import type { ClientConfig } from '@/lib/clients';
import { resolveClientConfig } from '@/lib/clients/registry';
import { readPulseClientLogo } from '@/lib/clients/pulse-store';
import { docxImageType, fitToBox, imageDimensions, LOGO_BOX } from '@/lib/clients/logo-size';
import fs from 'fs';
import path from 'path';

type BriefSource = 'shamal' | 'agency';

// Helper function to parse People data and create table rows
function parsePeopleData(peopleText: string): TableRow[] {
    if (!peopleText || peopleText === "Not provided") {
        return [
            new TableRow({
                children: [
                    new TableCell({
                        children: [new Paragraph({ text: "" })],
                        width: { size: 30, type: WidthType.PERCENTAGE },
                    }),
                    new TableCell({
                        children: [new Paragraph({ text: "" })],
                        width: { size: 70, type: WidthType.PERCENTAGE },
                    }),
                ],
            }),
        ];
    }

    const lines = peopleText.split('\n').filter(line => line.trim());
    const rows: TableRow[] = [];

    for (const line of lines) {
        const parts = line.split(/[:|\-]/);
        if (parts.length >= 2) {
            const role = parts[0].trim();
            const name = parts.slice(1).join(':').trim();

            rows.push(
                new TableRow({
                    children: [
                        new TableCell({
                            children: [new Paragraph({ text: role })],
                            width: { size: 30, type: WidthType.PERCENTAGE },
                        }),
                        new TableCell({
                            children: [new Paragraph({ text: name })],
                            width: { size: 70, type: WidthType.PERCENTAGE },
                        }),
                    ],
                })
            );
        }
    }

    if (rows.length === 0) {
        rows.push(
            new TableRow({
                children: [
                    new TableCell({
                        children: [new Paragraph({ text: peopleText })],
                        width: { size: 30, type: WidthType.PERCENTAGE },
                    }),
                    new TableCell({
                        children: [new Paragraph({ text: "" })],
                        width: { size: 70, type: WidthType.PERCENTAGE },
                    }),
                ],
            })
        );
    }

    return rows;
}

// Helper function to parse Stakeholder data and create table rows
function parseStakeholderData(stakeholderText: string): TableRow[] {
    if (!stakeholderText || stakeholderText === "Not provided") {
        return [
            new TableRow({
                children: [
                    new TableCell({
                        children: [new Paragraph({ text: "" })],
                        width: { size: 30, type: WidthType.PERCENTAGE },
                    }),
                    new TableCell({
                        children: [new Paragraph({ text: "" })],
                        width: { size: 70, type: WidthType.PERCENTAGE },
                    }),
                ],
            }),
        ];
    }

    const lines = stakeholderText.split('\n').filter(line => line.trim());
    const rows: TableRow[] = [];

    for (const line of lines) {
        const role = line.trim();

        rows.push(
            new TableRow({
                children: [
                    new TableCell({
                        children: [new Paragraph({ text: role })],
                        width: { size: 30, type: WidthType.PERCENTAGE },
                    }),
                    new TableCell({
                        children: [new Paragraph({ text: "" })],
                        width: { size: 70, type: WidthType.PERCENTAGE },
                    }),
                ],
            })
        );
    }

    if (rows.length === 0) {
        rows.push(
            new TableRow({
                children: [
                    new TableCell({
                        children: [new Paragraph({ text: stakeholderText })],
                        width: { size: 30, type: WidthType.PERCENTAGE },
                    }),
                    new TableCell({
                        children: [new Paragraph({ text: "" })],
                        width: { size: 70, type: WidthType.PERCENTAGE },
                    }),
                ],
            })
        );
    }

    return rows;
}

// Question IDs that should render as people tables (Role: Name)
const PEOPLE_TABLE_IDS = new Set(['people', 'stakeholders']);
// Question IDs that should render as sign-off tables (Role | Signature)
const SIGNOFF_TABLE_IDS = new Set(['stakeholder_signoff', 'approvals']);

/**
 * An answer as one Paragraph per line, so line breaks survive into Word.
 *
 * Blank lines are dropped rather than emitted as empty paragraphs — a model answer commonly
 * double-spaces its bullets, which would otherwise double the section's height. Spacing after
 * the final line matches what the old single-paragraph version used.
 */
function buildBodyParagraphs(content: string): Paragraph[] {
    const lines = (content || "Not provided").split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.length > 0);
    if (lines.length === 0) return [new Paragraph({ text: "Not provided", spacing: { after: 400 } })];
    return lines.map((line, i) =>
        new Paragraph({ text: line, spacing: { after: i === lines.length - 1 ? 400 : 60 } }),
    );
}

/** The verify-before-use caution printed under a question the model wrote rather than extracted. */
function buildGeneratedCaution(): Paragraph {
    return new Paragraph({
        children: [
            new TextRun({
                text: "AI-written from general knowledge, not from the uploaded materials — verify before use.",
                italics: true,
                size: 18,
                color: "B45309",
            }),
        ],
        spacing: { after: 120 },
    });
}

/** A section heading, emitted when a run of questions starts a new `section`. */
function buildSectionHeading(title: string): Paragraph {
    return new Paragraph({
        children: [new TextRun({ text: title, bold: true, size: 32, color: "1F2937" })],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 160 },
    });
}

/**
 * A run of `tableRow` questions as ONE two-column table: question title | answer.
 *
 * This is how a checklist the client drew as a table comes out as a table rather than as five
 * separate ones. Deliberately NOT routed through parsePeopleData: that splits each line on
 * /[:|-]/, which would chop "Inaugural 14 June 2026 · 4x weekly" into nonsense cells. Each
 * answer keeps its own line breaks via buildBodyParagraphs.
 */
function buildGroupedTable(rows: { title: string; content: string }[]): Table {
    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: "Category", bold: true })] })],
                        width: { size: 30, type: WidthType.PERCENTAGE },
                        shading: { fill: "E0E0E0" },
                    }),
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: "Practical requirements", bold: true })] })],
                        width: { size: 70, type: WidthType.PERCENTAGE },
                        shading: { fill: "E0E0E0" },
                    }),
                ],
            }),
            ...rows.map((r) =>
                new TableRow({
                    children: [
                        new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: r.title, bold: true })] })],
                            width: { size: 30, type: WidthType.PERCENTAGE },
                        }),
                        new TableCell({
                            children: buildBodyParagraphs(r.content),
                            width: { size: 70, type: WidthType.PERCENTAGE },
                        }),
                    ],
                }),
            ),
        ],
    });
}

function buildSectionForQuestion(
    title: string,
    questionId: string,
    content: string,
    generated = false,
): (Paragraph | Table)[] {
    const elements: (Paragraph | Table)[] = [];

    // Section heading
    elements.push(
        new Paragraph({
            children: [
                new TextRun({
                    text: title,
                    bold: true,
                    size: 28,
                    color: "0066CC",
                }),
            ],
            heading: HeadingLevel.HEADING_2,
            spacing: {
                before: 240,
                after: 120,
            },
        })
    );

    if (generated) elements.push(buildGeneratedCaution());

    if (PEOPLE_TABLE_IDS.has(questionId)) {
        // Render as people table
        elements.push(
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                    new TableRow({
                        children: [
                            new TableCell({
                                children: [new Paragraph({ children: [new TextRun({ text: "Role", bold: true })] })],
                                width: { size: 30, type: WidthType.PERCENTAGE },
                                shading: { fill: "E0E0E0" },
                            }),
                            new TableCell({
                                children: [new Paragraph({ children: [new TextRun({ text: "Name", bold: true })] })],
                                width: { size: 70, type: WidthType.PERCENTAGE },
                                shading: { fill: "E0E0E0" },
                            }),
                        ],
                    }),
                    ...parsePeopleData(content || "Not provided"),
                ],
            })
        );
    } else if (SIGNOFF_TABLE_IDS.has(questionId)) {
        // Render as sign-off table
        elements.push(
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                    new TableRow({
                        children: [
                            new TableCell({
                                children: [new Paragraph({ children: [new TextRun({ text: "Role", bold: true })] })],
                                width: { size: 30, type: WidthType.PERCENTAGE },
                                shading: { fill: "E0E0E0" },
                            }),
                            new TableCell({
                                children: [new Paragraph({ children: [new TextRun({ text: "Signature", bold: true })] })],
                                width: { size: 70, type: WidthType.PERCENTAGE },
                                shading: { fill: "E0E0E0" },
                            }),
                        ],
                    }),
                    ...parseStakeholderData(content || "Not provided"),
                ],
            })
        );
    } else {
        // Regular text section.
        //
        // One Paragraph PER LINE, not one Paragraph for the whole answer. docx 9.5.1 forwards a
        // string to TextRun untouched and never converts "\n" into <w:br/>, so the previous
        // single-Paragraph version collapsed every multi-line answer into one run of running
        // text — while AnswerCard's whitespace-pre-wrap showed it correctly on screen. Bulleted
        // or multi-line answers looked right to whoever wrote them and arrived as mush in the
        // deliverable. This affects every tier, not just the ones using the new fields.
        elements.push(...buildBodyParagraphs(content));
    }

    // Spacer after tables
    if (PEOPLE_TABLE_IDS.has(questionId) || SIGNOFF_TABLE_IDS.has(questionId)) {
        elements.push(new Paragraph({ text: "", spacing: { after: 400 } }));
    }

    return elements;
}

interface HeaderLogo {
    data: Buffer;
    transformation: { width: number; height: number };
    type: 'png' | 'jpg' | 'gif' | 'bmp';
}

/**
 * A compile-time client's logo, read from public/ exactly as before.
 *
 * Sizing stays hand-set (logoWidth/logoHeight, defaulting to 100x26) rather than measured:
 * those numbers were chosen by eye per brand and already look right, and recomputing them
 * would silently change the header of every existing client's briefs.
 */
function loadStaticLogo(config: ClientConfig): HeaderLogo | null {
    if (!config.logo) return null;
    const data = fs.readFileSync(path.join(process.cwd(), 'public', config.logo));
    const ext = path.extname(config.logo).toLowerCase();
    return {
        data,
        // The hand-set values, unchanged. P&O is 38x35 because its mark is nearly square;
        // measuring instead would silently restyle every existing client's header.
        transformation: { width: config.logoWidth ?? 100, height: config.logoHeight ?? 26 },
        type: ext === '.jpg' || ext === '.jpeg' ? 'jpg' : 'png',
    };
}

/**
 * A Pulse-synced brand's logo, from the database.
 *
 * Sized from the image's own header rather than a default, because nobody picked a width for
 * this brand: Pulse hands over bytes with no display size, and forcing the wide 100x26
 * default onto a square mark renders it squashed in every brief. See lib/clients/logo-size.ts.
 *
 * Returns null — not an error — for a brand with no logo, and for an SVG, which docx cannot
 * embed without a raster fallback. Both land on the name-TextRun path.
 */
async function loadSyncedLogo(clientId: string): Promise<HeaderLogo | null> {
    const stored = await readPulseClientLogo(clientId);
    if (!stored) return null;

    const type = docxImageType(stored.contentType);
    if (!type) {
        console.warn(`Client logo not embeddable for "${clientId}": docx cannot carry ${stored.contentType}`);
        return null;
    }

    const intrinsic = imageDimensions(stored.buffer);
    return {
        data: stored.buffer,
        // No intrinsic size readable: keep the historic default rather than guessing.
        transformation: intrinsic ? fitToBox(intrinsic, LOGO_BOX) : { width: 100, height: 26 },
        type,
    };
}

export async function POST(req: Request) {
    try {
        const { briefType, clientId, responses, briefSource } = (await req.json()) as {
            briefType?: string;
            clientId?: string;
            responses: Record<string, string>;
            briefSource?: BriefSource;
        };

        const source: BriefSource = briefSource === 'agency' ? 'agency' : 'shamal';

        const config = source === 'agency'
            ? getAgencyBriefConfig(briefType || 'big-idea')
            : getBriefConfig(briefType || 'strategy');

        const documentTitle = config?.documentTitle || 'Campaign Brief';
        const questions = config?.questions || [];

        // The first question is always the brief/campaign/project name
        const briefNameId = questions[0]?.id || 'brief_name';
        const briefName = responses[briefNameId] || "Brief";

        const today = new Date();
        const formattedDate = today.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Build document sections dynamically from questions
        const contentSections: (Paragraph | Table)[] = [];

        // Only AgencyQuestion carries section/generated/tableRow; the Shamal configs use the
        // base Question. Read them through one optional-field view so this loop works for both
        // and a Shamal brief behaves exactly as it did.
        type RenderableQuestion = { id: string; title: string; section?: string; generated?: boolean; tableRow?: boolean };
        const renderable = questions as RenderableQuestion[];

        // Skip first question (brief name) — it's used as the H1 title
        let openSection: string | undefined;
        for (let i = 1; i < renderable.length; i++) {
            const q = renderable[i];

            // A new `section` opens a heading. Questions sharing a section must be contiguous —
            // see the field's doc comment in lib/questions/agency/types.ts.
            if (q.section && q.section !== openSection) {
                contentSections.push(buildSectionHeading(q.section));
                openSection = q.section;
            } else if (!q.section) {
                openSection = undefined;
            }

            // A contiguous run of tableRow questions inside one section becomes ONE table, so a
            // checklist the client drew as a table arrives as a table rather than as N of them.
            if (q.tableRow) {
                const run: { title: string; content: string }[] = [];
                let j = i;
                while (j < renderable.length && renderable[j].tableRow && renderable[j].section === q.section) {
                    run.push({ title: renderable[j].title, content: responses[renderable[j].id] });
                    j++;
                }
                contentSections.push(buildGroupedTable(run));
                contentSections.push(new Paragraph({ text: "", spacing: { after: 400 } }));
                i = j - 1;
                continue;
            }

            contentSections.push(
                ...buildSectionForQuestion(q.title, q.id, responses[q.id], q.generated),
            );
        }

        // Build header — Shamal flow includes the Shamal logo on the right; agency flow is Omnicom-only.
        const headerChildren: (TextRun | ImageRun)[] = [
            new TextRun({ text: 'Omnicom', bold: true, size: 22, font: 'Arial' }),
            new TextRun({ text: 'Group', bold: false, size: 22, font: 'Arial' }),
        ];

        if (source === 'shamal') {
            const publicDir = path.join(process.cwd(), 'public');
            const shamalLogo = fs.readFileSync(path.join(publicDir, 'shamal-logo.png'));
            headerChildren.push(
                new TextRun({ text: '\t' }),
                new ImageRun({
                    data: shamalLogo,
                    transformation: { width: 100, height: 26 },
                    type: 'png',
                }),
            );
        } else {
            // Agency flow: brand the header per client when one is selected.
            //
            // Resolved across both registries. A brand onboarded from Pulse has no file under
            // public/ — Vercel's filesystem is read-only at runtime — so its bytes come from
            // the database instead. That is the ONE place the two kinds of client differ.
            const clientConfig = await resolveClientConfig(clientId);
            let clientLogoEmbedded = false;

            if (clientConfig) {
                try {
                    const logo = clientConfig.source === 'pulse'
                        ? await loadSyncedLogo(clientConfig.id)
                        : loadStaticLogo(clientConfig);

                    if (logo) {
                        headerChildren.push(
                            new TextRun({ text: '\t' }),
                            new ImageRun({
                                data: logo.data,
                                transformation: logo.transformation,
                                type: logo.type,
                            }),
                        );
                        clientLogoEmbedded = true;
                    }
                } catch (err) {
                    // Missing file, unreadable row, unembeddable format — fall back to the
                    // client name below. A brief must still generate without its logo.
                    console.warn(`Client logo not embedded for "${clientConfig.id}":`, err instanceof Error ? err.message : err);
                }
            }

            if (!clientLogoEmbedded) {
                headerChildren.push(
                    new TextRun({ text: '\t' }),
                    new TextRun({ text: clientConfig?.label || 'IMPACT BBDO', bold: true, size: 22, font: 'Arial' }),
                );
            }
        }

        const doc = new Document({
            sections: [{
                properties: {
                    page: {
                        margin: {
                            top: 1440,
                            right: 1440,
                            bottom: 1440,
                            left: 1440,
                        },
                    },
                },
                headers: {
                    default: new Header({
                        children: [
                            new Paragraph({
                                children: headerChildren,
                                tabStops: [
                                    {
                                        type: TabStopType.RIGHT,
                                        position: TabStopPosition.MAX,
                                    },
                                ],
                                spacing: { after: 200 },
                            }),
                        ],
                    }),
                },
                children: [
                    // Title
                    new Paragraph({
                        text: documentTitle,
                        heading: HeadingLevel.TITLE,
                        spacing: { after: 100 },
                    }),

                    // Date
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `DATE: ${formattedDate}`,
                                bold: true,
                                size: 20,
                            }),
                        ],
                        spacing: { after: 200 },
                    }),

                    // Brief Name as H1
                    new Paragraph({
                        text: briefName,
                        heading: HeadingLevel.HEADING_1,
                        spacing: { after: 400 },
                    }),

                    // All dynamic sections
                    ...contentSections,
                ],
            }],
        });

        const buffer = await Packer.toBuffer(doc);

        const safeDocTitle = documentTitle.replace(/[^\x00-\x7F]/g, '').replace(/\s+/g, '_');
        const safeBriefName = briefName.replace(/[^\x00-\x7F]/g, '').replace(/\s+/g, '_') || 'Brief';
        const filename = `${safeDocTitle}_${safeBriefName}_${Date.now()}.docx`;

        return new NextResponse(buffer as unknown as BodyInit, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });

    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Document generation error:', error);
        return NextResponse.json({ error: 'Document generation failed', detail: message }, { status: 500 });
    }
}
