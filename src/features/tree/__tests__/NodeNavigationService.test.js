import NodeNavigationService from 'features/tree/services/node-assistant/NodeNavigationService';

describe('NodeNavigationService', () => {
    let service;
    let mockNodes;
    let mockLinks;

    beforeEach(() => {
        service = new NodeNavigationService();

    // 테스트용 노드 데이터
    mockNodes = [
      { id: 'root', keyword: 'Root Node', nodeType: 'question' },
      { id: 'child1', keyword: 'Child 1', nodeType: 'question' },
      { id: 'child2', keyword: 'Child 2', nodeType: 'question' },
      { id: 'grandchild1', keyword: 'Grandchild 1', nodeType: 'question' },
      { id: 'grandchild2', keyword: 'Grandchild 2', nodeType: 'question' },
    ];

    // 테스트용 링크 데이터
    mockLinks = [
      { source: 'root', target: 'child1' },
      { source: 'root', target: 'child2' },
      { source: 'child1', target: 'grandchild1' },
      { source: 'child1', target: 'grandchild2' },
    ];

        service.setTreeData(mockNodes, mockLinks);
    });

    describe('findParentNode', () => {
        test('should find parent node for child', () => {
            const parent = service.findParentNode('child1');
            expect(parent).toEqual(mockNodes[0]); // root
        });

        test('should return null for root node', () => {
            const parent = service.findParentNode('root');
            expect(parent).toBeNull();
        });
    });

    describe('findChildNodes', () => {
        test('should find all child nodes', () => {
            const children = service.findChildNodes('root');
            expect(children).toHaveLength(2);
            expect(children[0].id).toBe('child1');
            expect(children[1].id).toBe('child2');
        });

        test('should return empty array for leaf node', () => {
            const children = service.findChildNodes('grandchild1');
            expect(children).toHaveLength(0);
        });
    });

    describe('findSiblingNodes', () => {
        test('should find sibling nodes including self', () => {
            const siblings = service.findSiblingNodes('child1');
            expect(siblings).toHaveLength(2);
            expect(siblings[0].id).toBe('child1');
            expect(siblings[1].id).toBe('child2');
        });

        test('should find root siblings for root nodes', () => {
            const siblings = service.findSiblingNodes('root');
            expect(siblings).toHaveLength(1);
            expect(siblings[0].id).toBe('root');
        });
    });

    describe('navigation', () => {
        test('should navigate up to parent', () => {
            const target = service.navigate('child1', 'ArrowUp');
            expect(target.id).toBe('root');
        });

        test('should navigate down to first child', () => {
            const target = service.navigate('root', 'ArrowDown');
            expect(target.id).toBe('child1');
        });

        test('should navigate left to previous sibling', () => {
            const target = service.navigate('child2', 'ArrowLeft');
            expect(target.id).toBe('child1');
        });

        test('should navigate right to next sibling', () => {
            const target = service.navigate('child1', 'ArrowRight');
            expect(target.id).toBe('child2');
        });

        test('should return null when no navigation possible', () => {
            const target = service.navigate('root', 'ArrowUp');
            expect(target).toBeNull();
        });
    });

    describe('getSiblingIndex', () => {
        test('should return correct sibling index', () => {
            const index1 = service.getSiblingIndex('child1');
            const index2 = service.getSiblingIndex('child2');

            expect(index1).toBe(0);
            expect(index2).toBe(1);
        });
    });

    describe('getNodePathInfo', () => {
      test('should return complete path info for node', () => {
        const pathInfo = service.getNodePathInfo('child1');
        
        expect(pathInfo.node.id).toBe('child1');
        expect(pathInfo.parent.id).toBe('root');
        expect(pathInfo.children).toHaveLength(2);
        expect(pathInfo.siblings).toHaveLength(2);
        expect(pathInfo.siblingIndex).toBe(0);
        expect(pathInfo.hasParent).toBe(true);
        expect(pathInfo.hasChildren).toBe(true);
        expect(pathInfo.hasSiblings).toBe(true);
      });
    });

  });
