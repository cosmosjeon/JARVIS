export const treeData = {
  nodes: [
    {
      id: "CEO",
      keyword: "CEO",
      fullText: "Chief Executive Officer responsible for overall company strategy and vision",
      level: 0,
      size: 20,
    },
    {
      id: "CTO",
      keyword: "CTO",
      fullText: "Chief Technology Officer overseeing technical infrastructure and innovation",
      level: 1,
      size: 15,
    },
    {
      id: "CFO",
      keyword: "CFO",
      fullText: "Chief Financial Officer managing financial operations and strategic planning",
      level: 1,
      size: 15,
    },
    {
      id: "CMO",
      keyword: "CMO",
      fullText: "Chief Marketing Officer driving brand strategy and customer acquisition",
      level: 1,
      size: 15,
    },
  ],
  links: [
    { source: "CEO", target: "CTO", value: 3 },
    { source: "CEO", target: "CFO", value: 3 },
    { source: "CEO", target: "CMO", value: 3 },
  ],
};
