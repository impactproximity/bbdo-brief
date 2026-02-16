import { NextResponse } from 'next/server';
import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer, Table, TableCell, TableRow, WidthType, BorderStyle } from 'docx';
import { getBriefConfig } from '@/lib/questions';

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

function buildSectionForQuestion(
    title: string,
    questionId: string,
    content: string,
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
        // Regular text section
        elements.push(
            new Paragraph({
                text: content || "Not provided",
                spacing: { after: 400 },
            })
        );
    }

    // Spacer after tables
    if (PEOPLE_TABLE_IDS.has(questionId) || SIGNOFF_TABLE_IDS.has(questionId)) {
        elements.push(new Paragraph({ text: "", spacing: { after: 400 } }));
    }

    return elements;
}

export async function POST(req: Request) {
    try {
        const { briefType, responses } = await req.json();

        const config = getBriefConfig(briefType || 'strategy');
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

        // Skip first question (brief name) — it's used as the H1 title
        for (let i = 1; i < questions.length; i++) {
            const q = questions[i];
            const sectionElements = buildSectionForQuestion(
                q.title,
                q.id,
                responses[q.id],
            );
            contentSections.push(...sectionElements);
        }

        const doc = new Document({
            sections: [{
                properties: {},
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

        const filename = `${documentTitle.replace(/\s+/g, '_')}_${briefName.replace(/\s+/g, '_')}_${Date.now()}.docx`;

        return new NextResponse(buffer as unknown as BodyInit, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });

    } catch (error) {
        console.error('Document generation error:', error);
        return NextResponse.json({ error: 'Document generation failed' }, { status: 500 });
    }
}
