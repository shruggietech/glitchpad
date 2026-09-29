export const agentContractStart =
  '<!-- BEGIN GENERATED BRANDBUILDER AGENT CONTRACT -->';
export const agentContractEnd =
  '<!-- END GENERATED BRANDBUILDER AGENT CONTRACT -->';
export const agentContractContext =
  'Repository integration context: generated paths are kit-root-relative. In this repository, the kit root is `brand/`; resolve `consumer-contract.json` and `IMPLEMENTATION.md` in `brand/enforcement/`, and prefix every generated `enforcement/...` path with `brand/`.';

function contractBlock(generatedContract) {
  return `${agentContractStart}\n\n${agentContractContext}\n\n${generatedContract.trim()}\n${agentContractEnd}`;
}

export function mergeAgentContract(projectInstructions, generatedContract) {
  const startCount = projectInstructions.split(agentContractStart).length - 1;
  const endCount = projectInstructions.split(agentContractEnd).length - 1;
  if (startCount !== endCount || startCount > 1) {
    throw new Error(
      'root AGENTS.md has malformed generated BrandBuilder contract markers',
    );
  }

  const block = contractBlock(generatedContract);
  if (startCount === 0) return `${projectInstructions.trimEnd()}\n\n${block}\n`;

  const start = projectInstructions.indexOf(agentContractStart);
  const end = projectInstructions.indexOf(agentContractEnd, start);
  return `${projectInstructions.slice(0, start)}${block}${projectInstructions.slice(end + agentContractEnd.length)}`;
}

export function verifyAgentContract(projectInstructions, generatedContract) {
  const expected = contractBlock(generatedContract);
  const startCount = projectInstructions.split(agentContractStart).length - 1;
  const endCount = projectInstructions.split(agentContractEnd).length - 1;
  if (startCount !== 1 || endCount !== 1) {
    return [
      'root AGENTS.md must contain exactly one generated BrandBuilder agent contract block',
    ];
  }
  return projectInstructions.includes(expected)
    ? []
    : ['root AGENTS.md generated BrandBuilder agent contract is stale'];
}
