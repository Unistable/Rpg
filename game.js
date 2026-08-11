// Navigation Graph System for 2D RPG Strategy Game

class Node {
    constructor(id, x, y) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.edges = []; // Connected edges
        this.neighbors = []; // Connected node IDs
    }
}

class Edge {
    constructor(id, nodeA, nodeB, type = 'walk') {
        this.id = id;
        this.nodeA = nodeA;
        this.nodeB = nodeB;
        this.type = type;
        this.cost = 1.0;
        this.speed = 1.0;
        this.capacity = 1;
        
        // Set default properties based on type
        this.applyTypeDefaults();
    }
    
    applyTypeDefaults() {
        switch(this.type) {
            case 'walk':
                this.cost = 1.0;
                this.speed = 1.0;
                break;
            case 'run':
                this.cost = 2.0;
                this.speed = 2.0;
                break;
            case 'ambush':
                this.cost = 1.5;
                this.speed = 0.7;
                break;
            case 'defence':
                this.cost = 3.0;
                this.speed = 0.5;
                break;
        }
    }
    
    getOtherNode(nodeId) {
        return this.nodeA === nodeId ? this.nodeB : this.nodeA;
    }
}

class Unit {
    constructor(id, startNode) {
        this.id = id;
        this.currentNode = startNode;
        this.targetNode = null;
        this.path = [];
        this.progress = 0;
        this.color = `hsl(${Math.random() * 360}, 70%, 50%)`;
        this.size = 8;
    }
}

class PriorityQueue {
    constructor() {
        this.elements = [];
    }
    
    isEmpty() {
        return this.elements.length === 0;
    }
    
    enqueue(item, priority) {
        this.elements.push({ item, priority });
        this.elements.sort((a, b) => a.priority - b.priority);
    }
    
    dequeue() {
        return this.elements.shift()?.item;
    }
}

class NavigationGraph {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.nodes = new Map();
        this.edges = new Map();
        this.units = [];
        this.nodeCounter = 0;
        this.edgeCounter = 0;
        
        // Selection
        this.selectedNode = null;
        this.selectedEdge = null;
        
        // Mouse state
        this.mouseX = 0;
        this.mouseY = 0;
        this.isDragging = false;
        this.dragStartNode = null;
        this.isRightDragging = false;
        this.rightDragNode = null;
        
        // Interaction
        this.hoveredNode = null;
        this.hoveredEdge = null;
        
        // Auto-move units
        this.autoMoveEnabled = false;
        
        // Setup canvas
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        // Event listeners
        this.setupEventListeners();
        
        // Animation
        this.lastTime = 0;
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }
    
    resize() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
    }
    
    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    }
    
    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouseX = e.clientX - rect.left;
        this.mouseY = e.clientY - rect.top;
        
        if (e.button === 0) { // Left click
            const clickedNode = this.findNodeAt(this.mouseX, this.mouseY);
            
            if (clickedNode) {
                this.selectNode(clickedNode);
                this.isDragging = true;
                this.dragStartNode = clickedNode;
            } else {
                const clickedEdge = this.findEdgeAt(this.mouseX, this.mouseY);
                if (clickedEdge) {
                    this.selectEdge(clickedEdge);
                } else {
                    this.deselectAll();
                    // Create new node on click
                    this.createNode(this.mouseX, this.mouseY);
                }
            }
        } else if (e.button === 2) { // Right click
            const clickedNode = this.findNodeAt(this.mouseX, this.mouseY);
            if (clickedNode) {
                this.selectNode(clickedNode);
                this.isRightDragging = true;
                this.rightDragNode = clickedNode;
            }
        }
        
        this.updateUI();
    }
    
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouseX = e.clientX - rect.left;
        this.mouseY = e.clientY - rect.top;
        
        // Update hover state
        this.hoveredNode = this.findNodeAt(this.mouseX, this.mouseY);
        this.hoveredEdge = this.findEdgeAt(this.mouseX, this.mouseY);
        
        // Handle right drag (move node)
        if (this.isRightDragging && this.rightDragNode) {
            this.rightDragNode.x = this.mouseX;
            this.rightDragNode.y = this.mouseY;
            this.updateUI();
        }
        
        // Update tooltip
        this.updateTooltip();
    }
    
    handleMouseUp(e) {
        if (e.button === 0 && this.isDragging && this.dragStartNode) {
            const rect = this.canvas.getBoundingClientRect();
            const endX = e.clientX - rect.left;
            const endY = e.clientY - rect.top;
            
            // Check if dragged far enough to create edge
            const dx = endX - this.dragStartNode.x;
            const dy = endY - this.dragStartNode.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 30) {
                // Create new node and edge
                const newNode = this.createNode(endX, endY);
                if (newNode) {
                    this.createEdge(this.dragStartNode.id, newNode.id);
                }
            }
        }
        
        this.isDragging = false;
        this.dragStartNode = null;
        this.isRightDragging = false;
        this.rightDragNode = null;
    }
    
    handleKeyDown(e) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (this.selectedNode) {
                this.deleteNode(this.selectedNode);
            } else if (this.selectedEdge) {
                this.deleteEdge(this.selectedEdge);
            }
        }
    }
    
    createNode(x, y) {
        const id = `node_${this.nodeCounter++}`;
        const node = new Node(id, x, y);
        this.nodes.set(id, node);
        this.updateStats();
        return node;
    }
    
    createEdge(nodeIdA, nodeIdB) {
        // Check if edge already exists
        const existingEdge = this.findEdgeBetween(nodeIdA, nodeIdB);
        if (existingEdge) return existingEdge;
        
        const id = `edge_${this.edgeCounter++}`;
        const edge = new Edge(id, nodeIdA, nodeIdB);
        this.edges.set(id, edge);
        
        // Update node connections
        const nodeA = this.nodes.get(nodeIdA);
        const nodeB = this.nodes.get(nodeIdB);
        
        if (nodeA && nodeB) {
            nodeA.neighbors.push(nodeIdB);
            nodeB.neighbors.push(nodeIdA);
            nodeA.edges.push(id);
            nodeB.edges.push(id);
            
            // Check for cycle completion
            this.checkAndCompleteCycle(nodeA);
        }
        
        this.updateStats();
        return edge;
    }
    
    checkAndCompleteCycle(startNode) {
        // BFS to find if there's a path back to start through other nodes
        const visited = new Set();
        const queue = [[startNode.id, [startNode.id]]];
        
        while (queue.length > 0) {
            const [currentId, path] = queue.shift();
            const currentNode = this.nodes.get(currentId);
            
            for (const neighborId of currentNode.neighbors) {
                if (neighborId === startNode.id && path.length >= 3) {
                    // Found a cycle! Connect all nodes in the cycle
                    this.completeCycle(path);
                    return;
                }
                
                if (!visited.has(neighborId)) {
                    visited.add(neighborId);
                    queue.push([neighborId, [...path, neighborId]]);
                }
            }
        }
    }
    
    completeCycle(cyclePath) {
        // Connect all consecutive nodes in the cycle if not already connected
        for (let i = 0; i < cyclePath.length; i++) {
            const nodeA = cyclePath[i];
            const nodeB = cyclePath[(i + 1) % cyclePath.length];
            
            if (!this.findEdgeBetween(nodeA, nodeB)) {
                this.createEdge(nodeA, nodeB);
            }
        }
    }
    
    deleteNode(node) {
        // Remove all connected edges first
        const edgesToRemove = [...node.edges];
        for (const edgeId of edgesToRemove) {
            const edge = this.edges.get(edgeId);
            if (edge) {
                this.deleteEdge(edge);
            }
        }
        
        this.nodes.delete(node.id);
        this.deselectAll();
        this.updateStats();
    }
    
    deleteEdge(edge) {
        // Remove from nodes
        const nodeA = this.nodes.get(edge.nodeA);
        const nodeB = this.nodes.get(edge.nodeB);
        
        if (nodeA) {
            nodeA.neighbors = nodeA.neighbors.filter(n => n !== edge.nodeB);
            nodeA.edges = nodeA.edges.filter(e => e !== edge.id);
        }
        
        if (nodeB) {
            nodeB.neighbors = nodeB.neighbors.filter(n => n !== edge.nodeA);
            nodeB.edges = nodeB.edges.filter(e => e !== edge.id);
        }
        
        this.edges.delete(edge.id);
        
        if (this.selectedEdge === edge) {
            this.deselectAll();
        }
        
        this.updateStats();
    }
    
    findNodeAt(x, y) {
        const radius = 15;
        for (const node of this.nodes.values()) {
            const dx = x - node.x;
            const dy = y - node.y;
            if (dx * dx + dy * dy <= radius * radius) {
                return node;
            }
        }
        return null;
    }
    
    findEdgeAt(x, y) {
        const threshold = 10;
        for (const edge of this.edges.values()) {
            if (this.pointToEdgeDistance(x, y, edge) <= threshold) {
                return edge;
            }
        }
        return null;
    }
    
    findEdgeBetween(nodeIdA, nodeIdB) {
        for (const edge of this.edges.values()) {
            if ((edge.nodeA === nodeIdA && edge.nodeB === nodeIdB) ||
                (edge.nodeA === nodeIdB && edge.nodeB === nodeIdA)) {
                return edge;
            }
        }
        return null;
    }
    
    pointToEdgeDistance(px, py, edge) {
        const nodeA = this.nodes.get(edge.nodeA);
        const nodeB = this.nodes.get(edge.nodeB);
        
        if (!nodeA || !nodeB) return Infinity;
        
        const A = px - nodeA.x;
        const B = py - nodeA.y;
        const C = nodeB.x - nodeA.x;
        const D = nodeB.y - nodeA.y;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        
        if (lenSq !== 0) param = dot / lenSq;
        
        let xx, yy;
        
        if (param < 0) {
            xx = nodeA.x;
            yy = nodeA.y;
        } else if (param > 1) {
            xx = nodeB.x;
            yy = nodeB.y;
        } else {
            xx = nodeA.x + param * C;
            yy = nodeA.y + param * D;
        }
        
        const dx = px - xx;
        const dy = py - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    selectNode(node) {
        this.selectedNode = node;
        this.selectedEdge = null;
    }
    
    selectEdge(edge) {
        this.selectedEdge = edge;
        this.selectedNode = null;
    }
    
    deselectAll() {
        this.selectedNode = null;
        this.selectedEdge = null;
    }
    
    // A* Pathfinding
    findPath(startNodeId, endNodeId) {
        const startNode = this.nodes.get(startNodeId);
        const endNode = this.nodes.get(endNodeId);
        
        if (!startNode || !endNode) return null;
        
        const openSet = new PriorityQueue();
        const closedSet = new Set();
        const cameFrom = new Map();
        const gScore = new Map();
        const fScore = new Map();
        
        // Initialize
        for (const node of this.nodes.values()) {
            gScore.set(node.id, Infinity);
            fScore.set(node.id, Infinity);
        }
        
        gScore.set(startNode.id, 0);
        fScore.set(startNode.id, this.heuristic(startNode, endNode));
        openSet.enqueue(startNode.id, fScore.get(startNode.id));
        
        while (!openSet.isEmpty()) {
            const currentId = openSet.dequeue();
            
            if (currentId === endNode.id) {
                return this.reconstructPath(cameFrom, currentId);
            }
            
            closedSet.add(currentId);
            const currentNode = this.nodes.get(currentId);
            
            for (const neighborId of currentNode.neighbors) {
                if (closedSet.has(neighborId)) continue;
                
                const edge = this.findEdgeBetween(currentId, neighborId);
                if (!edge) continue;
                
                const tentativeGScore = gScore.get(currentId) + edge.cost;
                
                if (tentativeGScore < gScore.get(neighborId)) {
                    cameFrom.set(neighborId, currentId);
                    gScore.set(neighborId, tentativeGScore);
                    fScore.set(neighborId, tentativeGScore + this.heuristic(
                        this.nodes.get(neighborId), endNode
                    ));
                    openSet.enqueue(neighborId, fScore.get(neighborId));
                }
            }
        }
        
        return null; // No path found
    }
    
    heuristic(nodeA, nodeB) {
        // Euclidean distance as heuristic
        const dx = nodeA.x - nodeB.x;
        const dy = nodeA.y - nodeB.y;
        return Math.sqrt(dx * dx + dy * dy) * 0.1; // Scale factor
    }
    
    reconstructPath(cameFrom, currentId) {
        const path = [currentId];
        while (cameFrom.has(currentId)) {
            currentId = cameFrom.get(currentId);
            path.unshift(currentId);
        }
        return path;
    }
    
    // Unit management
    spawnUnit() {
        if (this.nodes.size === 0) {
            alert('Create some nodes first!');
            return;
        }
        
        const nodeIds = Array.from(this.nodes.keys());
        const randomNodeId = nodeIds[Math.floor(Math.random() * nodeIds.length)];
        const unit = new Unit(`unit_${this.units.length}`, randomNodeId);
        this.units.push(unit);
        this.updateStats();
    }
    
    moveUnitToRandomTarget(unit) {
        if (this.nodes.size < 2) return;
        
        const nodeIds = Array.from(this.nodes.keys());
        let targetNodeId;
        do {
            targetNodeId = nodeIds[Math.floor(Math.random() * nodeIds.length)];
        } while (targetNodeId === unit.currentNode && nodeIds.length > 1);
        
        unit.targetNode = targetNodeId;
        unit.path = this.findPath(unit.currentNode, targetNodeId);
        unit.progress = 0;
        
        if (unit.path && unit.path.length > 1) {
            console.log(`Unit ${unit.id} path: ${unit.path.join(' -> ')}`);
        }
    }
    
    updateUnits(deltaTime) {
        for (const unit of this.units) {
            if (unit.path && unit.path.length > 1) {
                // Get current edge
                const currentNodeId = unit.path[0];
                const nextNodeId = unit.path[1];
                const edge = this.findEdgeBetween(currentNodeId, nextNodeId);
                
                if (edge) {
                    const speed = edge.speed * 50 * deltaTime; // pixels per second
                    unit.progress += speed;
                    
                    if (unit.progress >= 1) {
                        // Reached next node
                        unit.path.shift();
                        unit.currentNode = nextNodeId;
                        unit.progress = 0;
                        
                        if (unit.path.length <= 1) {
                            // Reached destination
                            if (this.autoMoveEnabled) {
                                setTimeout(() => this.moveUnitToRandomTarget(unit), 500);
                            } else {
                                unit.path = [];
                                unit.targetNode = null;
                            }
                        }
                    }
                }
            } else if (this.autoMoveEnabled && !unit.path) {
                this.moveUnitToRandomTarget(unit);
            }
        }
    }
    
    testPathfinding() {
        if (!this.selectedNode) {
            alert('Select a starting node first');
            return;
        }
        
        if (this.nodes.size < 2) {
            alert('Need at least 2 nodes');
            return;
        }
        
        // Find furthest node as target
        let maxDist = 0;
        let targetNode = null;
        
        for (const node of this.nodes.values()) {
            if (node.id === this.selectedNode.id) continue;
            const dist = Math.sqrt(
                Math.pow(node.x - this.selectedNode.x, 2) +
                Math.pow(node.y - this.selectedNode.y, 2)
            );
            if (dist > maxDist) {
                maxDist = dist;
                targetNode = node;
            }
        }
        
        if (targetNode) {
            const path = this.findPath(this.selectedNode.id, targetNode.id);
            if (path) {
                console.log('Path found:', path);
                alert(`Path found: ${path.join(' → ')}\nTotal nodes: ${path.length}`);
            } else {
                alert('No path found!');
            }
        }
    }
    
    // UI Updates
    setEdgeType(type) {
        if (!this.selectedEdge) return;
        
        this.selectedEdge.type = type;
        this.selectedEdge.applyTypeDefaults();
        
        // Update button states
        document.querySelectorAll('.edge-type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });
        
        this.updateUI();
    }
    
    setEdgeCost(value) {
        if (!this.selectedEdge) return;
        this.selectedEdge.cost = parseFloat(value);
        document.getElementById('cost-value').textContent = value;
    }
    
    setEdgeSpeed(value) {
        if (!this.selectedEdge) return;
        this.selectedEdge.speed = parseFloat(value);
        document.getElementById('speed-value').textContent = value;
    }
    
    setEdgeCapacity(value) {
        if (!this.selectedEdge) return;
        this.selectedEdge.capacity = parseInt(value);
        document.getElementById('capacity-value').textContent = value;
    }
    
    updateUI() {
        const noSelection = document.getElementById('no-selection');
        const nodeProperties = document.getElementById('node-properties');
        const edgeProperties = document.getElementById('edge-properties');
        
        noSelection.style.display = 'none';
        nodeProperties.style.display = 'none';
        edgeProperties.style.display = 'none';
        
        if (this.selectedNode) {
            nodeProperties.style.display = 'block';
            document.getElementById('node-id').textContent = this.selectedNode.id;
            document.getElementById('node-pos').textContent = 
                `(${Math.round(this.selectedNode.x)}, ${Math.round(this.selectedNode.y)})`;
            document.getElementById('node-connections').textContent = 
                this.selectedNode.neighbors.length;
        } else if (this.selectedEdge) {
            edgeProperties.style.display = 'block';
            document.getElementById('cost-slider').value = this.selectedEdge.cost;
            document.getElementById('cost-value').textContent = this.selectedEdge.cost.toFixed(1);
            document.getElementById('speed-slider').value = this.selectedEdge.speed;
            document.getElementById('speed-value').textContent = this.selectedEdge.speed.toFixed(1);
            document.getElementById('capacity-input').value = this.selectedEdge.capacity;
            document.getElementById('capacity-value').textContent = this.selectedEdge.capacity;
            
            // Update button states
            document.querySelectorAll('.edge-type-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.type === this.selectedEdge.type);
            });
        } else {
            noSelection.style.display = 'block';
        }
    }
    
    updateTooltip() {
        const tooltip = document.getElementById('tooltip');
        
        if (this.hoveredNode) {
            tooltip.style.display = 'block';
            tooltip.innerHTML = `<strong>Node ${this.hoveredNode.id}</strong><br>` +
                `Connections: ${this.hoveredNode.neighbors.length}`;
            tooltip.style.left = `${this.mouseX + 15}px`;
            tooltip.style.top = `${this.mouseY + 15}px`;
        } else if (this.hoveredEdge) {
            tooltip.style.display = 'block';
            tooltip.innerHTML = `<strong>Edge ${this.hoveredEdge.id}</strong><br>` +
                `Type: ${this.hoveredEdge.type}<br>` +
                `Cost: ${this.hoveredEdge.cost.toFixed(1)} | Speed: ${this.hoveredEdge.speed.toFixed(1)}`;
            tooltip.style.left = `${this.mouseX + 15}px`;
            tooltip.style.top = `${this.mouseY + 15}px`;
        } else {
            tooltip.style.display = 'none';
        }
    }
    
    updateStats() {
        document.getElementById('node-count').textContent = this.nodes.size;
        document.getElementById('edge-count').textContent = this.edges.size;
        document.getElementById('unit-count').textContent = this.units.length;
    }
    
    clearGraph() {
        this.nodes.clear();
        this.edges.clear();
        this.units = [];
        this.nodeCounter = 0;
        this.edgeCounter = 0;
        this.deselectAll();
        this.updateStats();
        this.updateUI();
    }
    
    toggleAutoMove() {
        this.autoMoveEnabled = !this.autoMoveEnabled;
        
        if (this.autoMoveEnabled && this.units.length > 0) {
            for (const unit of this.units) {
                if (!unit.path) {
                    this.moveUnitToRandomTarget(unit);
                }
            }
        }
    }
    
    // Rendering
    getEdgeColor(type) {
        const colors = {
            walk: '#27ae60',
            run: '#e67e22',
            ambush: '#8e44ad',
            defence: '#2980b9'
        };
        return colors[type] || '#fff';
    }
    
    render() {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Clear canvas
        ctx.fillStyle = '#16213e';
        ctx.fillRect(0, 0, width, height);
        
        // Draw grid
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 1;
        const gridSize = 50;
        for (let x = 0; x < width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 0; y < height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        // Draw edges
        for (const edge of this.edges.values()) {
            const nodeA = this.nodes.get(edge.nodeA);
            const nodeB = this.nodes.get(edge.nodeB);
            
            if (!nodeA || !nodeB) continue;
            
            const color = this.getEdgeColor(edge.type);
            const isSelected = this.selectedEdge === edge;
            const isHovered = this.hoveredEdge === edge;
            
            ctx.strokeStyle = color;
            ctx.lineWidth = isSelected ? 4 : (isHovered ? 3 : 2);
            ctx.globalAlpha = isSelected || isHovered ? 1 : 0.7;
            
            ctx.beginPath();
            ctx.moveTo(nodeA.x, nodeA.y);
            ctx.lineTo(nodeB.x, nodeB.y);
            ctx.stroke();
            
            // Draw edge direction indicator (small arrow in middle)
            const midX = (nodeA.x + nodeB.x) / 2;
            const midY = (nodeA.y + nodeB.y) / 2;
            
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.8;
            ctx.beginPath();
            ctx.arc(midX, midY, 3, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw edge properties label
            ctx.globalAlpha = 0.6;
            ctx.fillStyle = '#fff';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${edge.cost.toFixed(1)}`, midX, midY - 8);
        }
        
        ctx.globalAlpha = 1;
        
        // Draw nodes
        for (const node of this.nodes.values()) {
            const isSelected = this.selectedNode === node;
            const isHovered = this.hoveredNode === node;
            const radius = isSelected ? 18 : (isHovered ? 16 : 12);
            
            // Outer glow for selected/hovered
            if (isSelected || isHovered) {
                ctx.beginPath();
                ctx.arc(node.x, node.y, radius + 5, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(233, 69, 96, 0.3)';
                ctx.fill();
            }
            
            // Node circle
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
            ctx.fillStyle = isSelected ? '#e94560' : (isHovered ? '#ff6b6b' : '#4a69bd');
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Node ID
            ctx.fillStyle = '#fff';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(node.id.split('_')[1], node.x, node.y);
        }
        
        // Draw drag preview line
        if (this.isDragging && this.dragStartNode) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(this.dragStartNode.x, this.dragStartNode.y);
            ctx.lineTo(this.mouseX, this.mouseY);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        
        // Draw units
        for (const unit of this.units) {
            const currentNode = this.nodes.get(unit.currentNode);
            if (!currentNode) continue;
            
            let drawX = currentNode.x;
            let drawY = currentNode.y;
            
            // Interpolate position along path
            if (unit.path && unit.path.length > 1) {
                const nextNodeId = unit.path[1];
                const nextNode = this.nodes.get(nextNodeId);
                if (nextNode) {
                    drawX = currentNode.x + (nextNode.x - currentNode.x) * unit.progress;
                    drawY = currentNode.y + (nextNode.y - currentNode.y) * unit.progress;
                }
            }
            
            // Draw unit
            ctx.beginPath();
            ctx.arc(drawX, drawY, unit.size, 0, Math.PI * 2);
            ctx.fillStyle = unit.color;
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Draw target indicator
            if (unit.targetNode) {
                const targetNode = this.nodes.get(unit.targetNode);
                if (targetNode) {
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                    ctx.lineWidth = 1;
                    ctx.setLineDash([3, 3]);
                    ctx.beginPath();
                    ctx.moveTo(drawX, drawY);
                    ctx.lineTo(targetNode.x, targetNode.y);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
            }
        }
    }
    
    animate(currentTime) {
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        
        this.updateUnits(deltaTime);
        this.render();
        
        requestAnimationFrame(this.animate);
    }
}

// Initialize game
const canvas = document.getElementById('game-canvas');
const game = new NavigationGraph(canvas);

// Expose game to window for UI callbacks
window.game = game;

console.log('Navigation Graph System initialized!');
console.log('Controls:');
console.log('  - LMB Click: Create node');
console.log('  - LMB Drag from node: Create edge + new node');
console.log('  - RMB Drag: Move node');
console.log('  - Delete: Remove selected node/edge');
console.log('  - Click: Select node/edge');
