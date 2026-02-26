import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req: Request) {
    try {
        const { questionTitle, userResponse } = await req.json();

        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json({
                enhancedResponse: `Mock enhanced response: ${userResponse} - Please configure your .env file with OPENAI_API_KEY.`,
            });
        }

        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        // Special handling for different question types
        const isCampaignName = questionTitle === 'Campaign Name';
        const isPeople = questionTitle === 'People';
        const isStakeholder = questionTitle === 'Stakeholder Sign-off';
        const isPartners = questionTitle === 'Partners Involved';
        const isSpokesperson = questionTitle === 'Spokesperson & Quote';
        const isVisualAssets = questionTitle === 'Visual Assets';

        let systemPrompt = '';

        if (isCampaignName) {
            systemPrompt = `You are a professional business brief assistant. The user is providing a campaign/brief name. Your task is to format it properly.

Rules for Campaign Name:
1. Create a clear, concise, professional campaign name (5-10 words max)
2. Use title case formatting
3. Keep it memorable and descriptive
4. Do not add extra explanation or detail
5. Return ONLY the campaign name, nothing else`;
        } else if (isPeople) {
            systemPrompt = `You are a professional business brief assistant. The user is providing information about people involved in the project.

Rules for People section:
1. Format each person as "Role: Name" on separate lines
2. Common roles include: Project Owner, Brief Builder, Approver, Partner, Campaign Manager
3. Extract roles and names from the user's input
4. Keep it organized and clear
5. Format example:
   Project Owner: John Doe
   Brief Builder: Jane Smith
   Approver: Sarah Johnson
6. Return ONLY the formatted list, no additional commentary`;
        } else if (isStakeholder) {
            systemPrompt = `You are a professional business brief assistant. The user is providing stakeholder roles who need to sign off.

Rules for Stakeholder Sign-off section:
1. List each role on a separate line
2. Common roles include: Key Decision Maker, Head Of, Executive Director, Agency Teams, Campaign Manager
3. Extract roles from the user's input
4. Do NOT include names or signatures, just roles
5. Format example:
   Key Decision Maker
   Head Of Marketing
   Executive Director
6. Return ONLY the role list, no additional commentary`;
        } else if (isPartners) {
            systemPrompt = `You are a professional business brief assistant. The user is listing partners involved in a press release.

Rules for Partners Involved section:
1. List each partner name or organisation on a separate line
2. Do not add descriptions, roles, or context beyond what the user stated
3. Do not elaborate or expand — just clean up the names as provided
4. Return ONLY the list, no additional commentary`;
        } else if (isVisualAssets) {
            systemPrompt = `You are a professional business brief assistant. The user is listing visual assets for a press release.

Rules for Visual Assets section:
1. List each asset type on a separate line
2. Do not explain why assets are important or add any justification
3. Do not expand beyond what the user stated — just clean up and format the list
4. Return ONLY the asset list, no additional commentary`;
        } else if (isSpokesperson) {
            systemPrompt = `You are a professional business brief assistant. The user is providing spokesperson details for a press release.

Rules for Spokesperson & Quote section:
1. Format as "Name, Role: [their sentiment or key point]"
2. Capture exactly what the user said the spokesperson feels or wants to convey — do NOT draft or fabricate a polished quote
3. Keep it brief and factual — one line per spokesperson
4. Do not expand, embellish, or invent wording beyond what was provided
5. Return ONLY the formatted entry, no additional commentary`;
        } else {
            systemPrompt = `You are a professional business brief assistant. Your task is to take the user's input and refine it into a well-articulated, professional response of exactly 3-4 lines.

Rules:
1. Clarify and refine the user's input using professional business language, staying strictly true to what they said
2. Do not add claims, scope, or intent that the user did not state or clearly imply
3. Keep the response concise: exactly 3-4 lines (approximately 60-100 words)
4. Do not embellish or overstate — preserve the original meaning and scale
5. Make it clear, specific, and actionable
6. Return ONLY the enhanced response, no additional commentary

Question Context: ${questionTitle}`;
        }

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userResponse }
            ],
            temperature: 0.3,
            max_tokens: 200,
        });

        const enhancedResponse = response.choices[0].message.content || userResponse;

        return NextResponse.json({
            enhancedResponse: enhancedResponse.trim()
        });

    } catch (error) {
        console.error('Chat error:', error);
        return NextResponse.json({ error: 'Chat failed' }, { status: 500 });
    }
}
