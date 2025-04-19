import type { MindMapNode } from './nlp';

export function mindMapToPlantUML(root: MindMapNode): string {
    let uml = '@startmindmap\n';

    function buildUml(node: MindMapNode, depth = 0) {
        const prefix = '+'.repeat(depth + 1);
        uml += `${prefix} ${node.label}\n`;

        node.children?.forEach(child => {
            buildUml(child, depth + 1);
        });
    }

    buildUml(root);
    uml += '@endmindmap';

    return uml;
}
