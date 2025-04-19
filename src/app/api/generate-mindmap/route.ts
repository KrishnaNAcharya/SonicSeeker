import { NextRequest, NextResponse } from 'next/server';
// Import your preferred LLM SDK (e.g., OpenAI)
// import OpenAI from 'openai';

// Configure LLM Client (using environment variables for API keys)
// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const { transcriptText } = await request.json();

    if (!transcriptText || typeof transcriptText !== 'string') {
      return NextResponse.json({ error: 'Invalid transcript text provided' }, { status: 400 });
    }

    // --- LLM Interaction ---
    // 1. Craft a detailed prompt asking the LLM to:
    //    - Identify the main topic.
    //    - Extract key sub-topics or concepts.
    //    - Determine relationships between topics.
    //    - Output the result as a JSON object containing 'nodes' and 'edges'
    //      arrays, compatible with React Flow.
    //    - Example Node: { id: '1', data: { label: 'Main Topic' }, position: { x: 0, y: 0 } }
    //    - Example Edge: { id: 'e1-2', source: '1', target: '2', label: 'relates to' }

    const prompt = `
      Analyze the following transcript and generate a mind map structure.
      Identify the central theme, key topics, sub-topics, and their relationships.
      Return the output strictly as a JSON object with two keys: "nodes" and "edges".

      - "nodes" should be an array of objects, each with:
        - "id": A unique string identifier (e.g., "node-1", "node-2").
        - "data": An object containing { "label": "Topic Name" }.
        - "position": An object { "x": number, "y": number } for initial layout (can be random or simple).
      - "edges" should be an array of objects, each with:
        - "id": A unique string identifier (e.g., "edge-1-2").
        - "source": The "id" of the source node.
        - "target": The "id" of the target node.
        - Optional: "label": A string describing the relationship.

      Ensure the JSON is valid. Do not include any text before or after the JSON object.

      Transcript:
      """
      ${transcriptText.substring(0, 8000)} 
      """

      JSON Output:
    `; // Limit transcript length if needed for the LLM context window

    console.log("Sending request to LLM for mind map generation...");

    // --- Replace with actual LLM API call ---
    // Example using OpenAI (adapt for your chosen LLM):
    /*
    const completion = await openai.chat.completions.create({
      model: "gpt-4o", // Or your preferred model
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }, // If supported by the model
    });

    const llmResponse = completion.choices[0]?.message?.content;
    */
    // --- Mock Response (Replace with actual LLM call) ---
    const llmResponse = JSON.stringify({
        nodes: [
            { id: '1', data: { label: 'Transcript Analysis (Mock)' }, position: { x: 250, y: 5 } },
            { id: '2', data: { label: 'Key Topic A' }, position: { x: 100, y: 100 } },
            { id: '3', data: { label: 'Key Topic B' }, position: { x: 400, y: 100 } },
            { id: '4', data: { label: 'Sub-topic A1' }, position: { x: 50, y: 200 } },
            { id: '5', data: { label: 'Sub-topic B1' }, position: { x: 350, y: 200 } },
        ],
        edges: [
            { id: 'e1-2', source: '1', target: '2', label: 'includes' },
            { id: 'e1-3', source: '1', target: '3', label: 'includes' },
            { id: 'e2-4', source: '2', target: '4', label: 'details' },
            { id: 'e3-5', source: '3', target: '5', label: 'details' },
            { id: 'e4-5', source: '4', target: '5', label: 'related to (mock)' }, // Example cross-link
        ],
    });
    // --- End Mock Response ---


    if (!llmResponse) {
      throw new Error('LLM did not return a response.');
    }

    console.log("Received response from LLM.");

    // Parse the LLM response (ensure it's valid JSON)
    let graphData;
    try {
      // Clean potential markdown code fences if LLM wraps output
      const cleanedResponse = llmResponse.replace(/```json\n?/, '').replace(/```$/, '').trim();
      graphData = JSON.parse(cleanedResponse);
      if (!graphData.nodes || !graphData.edges) {
         throw new Error("LLM response missing 'nodes' or 'edges' keys.");
      }
    } catch (parseError) {
      console.error("Failed to parse LLM response:", parseError);
      console.error("Raw LLM Response:", llmResponse);
      throw new Error('Failed to parse LLM response into valid JSON graph structure.');
    }

    return NextResponse.json(graphData);

  } catch (error: any) {
    console.error('Error generating mind map:', error);
    return NextResponse.json(
      { error: 'Failed to generate mind map', details: error.message },
      { status: 500 }
    );
  }
}
