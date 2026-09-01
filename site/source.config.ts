import { defineConfig, defineDocs } from 'fumadocs-mdx/config';

export const docs = defineDocs({ dir: 'content/docs' });

function remarkMermaid() {
  return (tree: { children?: unknown[] }) => {
    const walk = (node: { children?: unknown[] }) => {
      if (!Array.isArray(node.children)) return;
      node.children = node.children.map((child) => {
        const item = child as {
          type?: string;
          lang?: string;
          value?: string;
          children?: unknown[];
        };
        if (item.type === 'code' && item.lang === 'mermaid') {
          return {
            type: 'mdxJsxFlowElement',
            name: 'Mermaid',
            attributes: [
              {
                type: 'mdxJsxAttribute',
                name: 'chart',
                value: item.value ?? '',
              },
            ],
            children: [],
          };
        }
        walk(item);
        return child;
      });
    };
    walk(tree);
  };
}

export default defineConfig({
  mdxOptions: { remarkPlugins: [remarkMermaid] },
});
