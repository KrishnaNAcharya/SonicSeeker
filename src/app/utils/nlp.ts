import nlp from 'compromise';

const STOP_WORDS = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
    'can', 'could', 'may', 'might', 'must', 'shall', 'which', 'that', 'this',
    'these', 'those', 'it', 'its', 'they', 'them', 'their', 'there', 'here',
    'what', 'where', 'when', 'how', 'why', 'who', 'some', 'any', 'every',
    'many', 'few', 'several', 'such', 'own', 'just', 'about', 'also'
]);

export interface MindMapNode {
    label: string;
    children?: MindMapNode[];
}

function isSignificantTerm(term: string): boolean {
    return term.length > 3 &&
        !STOP_WORDS.has(term.toLowerCase()) &&
        !/\d{4}/.test(term);
}

function calculateTermScore(term: string, paragraph: string): number {
    const termCount = (paragraph.toLowerCase().match(
        new RegExp(`\\b${term.toLowerCase()}\\b`, 'g')) || []).length;

    const isEntity = term[0] === term[0].toUpperCase() && term.length > 4;
    const isVerb = nlp(term).verbs().found;

    return (termCount * 2) + (isEntity ? 5 : 0) + (isVerb ? 3 : 0);
}

function cleanLabel(label: string): string {
    return label
        .replace(/^[^a-zA-Z0-9]+/, '')
        .replace(/[^a-zA-Z0-9\s]+$/, '')
        .trim();
}

export function paragraphToMindMap(paragraph: string): MindMapNode {
    const doc = nlp(paragraph);

    // Extract and score main topic
    const mainTopic = doc.topics().out('array')
        .find(t => isSignificantTerm(t)) || 'Main Topic';

    // Extract and filter entities
    const people = doc.people().out('array')
        .filter(p => isSignificantTerm(p))
        .map(cleanLabel);

    const orgs = doc.organizations().out('array')
        .filter(o => isSignificantTerm(o))
        .map(cleanLabel);

    const places = doc.places().out('array')
        .filter(p => isSignificantTerm(p))
        .map(cleanLabel);

    // Process nouns with scoring
    const nouns = doc.nouns().out('array')
        .filter(n => isSignificantTerm(n))
        .map(cleanLabel)
        .sort((a, b) => calculateTermScore(b, paragraph) - calculateTermScore(a, paragraph))
        .slice(0, 10);

    // Process verbs
    const verbs = doc.verbs().out('array')
        .filter(v => isSignificantTerm(v) && !['have', 'has', 'had', 'be'].includes(v))
        .map(cleanLabel);

    // Build mind map structure
    const root: MindMapNode = {
        label: cleanLabel(mainTopic),
        children: []
    };

    // Add entities as children
    const uniqueEntities = [...new Set([...people, ...orgs, ...places, ...nouns])];
    uniqueEntities.forEach(entity => {
        root.children?.push({
            label: entity,
            children: []
        });
    });

    // Add verb relationships
    verbs.forEach(verb => {
        const relatedEntities = uniqueEntities.filter(e =>
            paragraph.toLowerCase().includes(`${verb.toLowerCase()} ${e.toLowerCase()}`) ||
            paragraph.toLowerCase().includes(`${e.toLowerCase()} ${verb.toLowerCase()}`)
        );

        if (relatedEntities.length > 1) {
            root.children?.push({
                label: verb,
                children: relatedEntities.map(e => ({ label: e }))
            });
        }
    });

    return root;
}

export function cleanMindMap(root: MindMapNode): MindMapNode {
    return {
        ...root,
        children: root.children
            ?.filter(child => child.label.trim().length > 0)
            .map(child => ({
                ...child,
                label: cleanLabel(child.label),
                children: child.children ? cleanMindMap(child).children : []
            }))
    };
}
