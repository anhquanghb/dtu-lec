
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AppState, Course } from '../types';
import { Image, ZoomIn, ZoomOut, Maximize, RotateCcw, MousePointer2, Minimize2, Layout, Filter, Layers } from 'lucide-react';
import { TRANSLATIONS } from '../constants';
import html2canvas from 'html2canvas';

interface Props {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
  onCourseNavigate: (courseId: string) => void;
}

const STATUS_COLORS = {
  'REQUIRED': 'bg-white border-slate-300 text-slate-900',
  'SELECTED_ELECTIVE': 'bg-blue-50 border-blue-200 text-blue-900',
  'ELECTIVE': 'bg-green-50 border-green-200 text-green-900'
};

// --- Geometry Types ---
type Point = { x: number; y: number };
type VerticalSegment = { x: number; yMin: number; yMax: number; id: string };

const FlowchartModule: React.FC<Props> = ({ state, updateState, onCourseNavigate }) => {
  const { courses, language, generalInfo } = state;
  const [hoveredCourseId, setHoveredCourseId] = useState<string | null>(null);
  const [isMinimalMode, setIsMinimalMode] = useState(false);
  const [statsScope, setStatsScope] = useState<'all' | 'abet'>('all');
  
  // Canvas State
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const t = TRANSLATIONS[language];
  const semesters = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  const targetCourses = useMemo(() => {
      if (statsScope === 'abet') {
          return courses.filter(c => c.isAbet);
      }
      return courses;
  }, [courses, statsScope]);

  // --- Dimensional Constants ---
  const CARD_WIDTH = 140; 
  const CARD_HEIGHT = 80;
  const BASE_COL_GAP = 60; 
  const BASE_ROW_GAP = 60;
  const SEM_LABEL_WIDTH = 40;
  const SIDE_GAP = 60;
  const LANE_SPACING = 12; 
  const JUMP_RADIUS = 6;
  const ELECTIVE_BLOCK_WIDTH = CARD_WIDTH + 40; 

  // ... (Unified Graph Logic hook) ...
  const { 
    processedEdges, // For drawing SVG
    highlightState, // For coloring cards
    courseBlockMap  // Course ID -> Block ID
  } = useMemo(() => {
    // Helper to normalize codes for matching
    const normalize = (s: string) => s ? s.trim().toUpperCase() : '';

    // Map sub-blocks
    const blockMap = new Map<string, string>();
    (generalInfo.moetInfo.subBlocks || []).forEach(sb => {
        sb.courseIds.forEach(cid => blockMap.set(cid, sb.id));
    });

    // 1. Build Lookups (ID Map and Code Map) - Based on TARGET courses
    const idMap = new Map<string, Course>();
    const codeMap = new Map<string, string>(); // Code -> ID

    targetCourses.forEach(c => { 
        idMap.set(c.id, c);
        const code = normalize(c.code);
        if (code) codeMap.set(code, c.id); 
    });

    // 2. Build Directed Graph (Prerequisites) & Undirected Graph (Coreqs)
    const adj: Record<string, string[]> = {};     // A -> B
    const revAdj: Record<string, string[]> = {};  // B <- A
    const coreqAdj: Record<string, string[]> = {}; // A <-> B
    
    // Store edges for Layout Calculation later
    const edgesList: { source: Course, target: Course, id: string }[] = [];

    targetCourses.forEach(c => {
        const cId = c.id;
        if (!adj[cId]) adj[cId] = [];
        if (!revAdj[cId]) revAdj[cId] = [];
        if (!coreqAdj[cId]) coreqAdj[cId] = [];

        // Process Prerequisites (Directed)
        c.prerequisites.forEach(pRaw => {
            const pNorm = normalize(pRaw);
            if (!pNorm) return;

            // Strategy: Resolve by ID first (CID), then fallback to Code
            let pId = idMap.has(pRaw) ? pRaw : codeMap.get(pNorm);

            // Ensure target exists in the filtered set and is not self
            if (pId && pId !== cId && idMap.has(pId)) {
                // Logic: pId is a prerequisite for cId
                if (!adj[pId]) adj[pId] = [];
                // Prevent duplicates
                if (!adj[pId].includes(cId)) {
                    adj[pId].push(cId);
                    // Add to layout edges
                    const pCourse = idMap.get(pId);
                    if (pCourse) {
                        edgesList.push({ source: pCourse, target: c, id: `${pId}-${cId}` });
                    }
                }
                
                if (!revAdj[cId]) revAdj[cId] = [];
                if (!revAdj[cId].includes(pId)) revAdj[cId].push(pId);
            }
        });

        // Process Co-requisites (Undirected/Symmetric)
        c.coRequisites.forEach(coRaw => {
            const coNorm = normalize(coRaw);
            if (!coNorm) return;

            let coId = idMap.has(coRaw) ? coRaw : codeMap.get(coNorm);

            // Ensure target exists in filtered set and is not self
            if (coId && coId !== cId && idMap.has(coId)) {
                if (!coreqAdj[cId].includes(coId)) coreqAdj[cId].push(coId);
                // Ensure symmetry immediately
                if (!coreqAdj[coId]) coreqAdj[coId] = [];
                if (!coreqAdj[coId].includes(cId)) coreqAdj[coId].push(cId);
            }
        });
    });

    // 3. Calculate Highlight Sets based on Hovered ID
    const ancestors = new Set<string>();
    const descendants = new Set<string>();
    const coreqs = new Set<string>();

    if (hoveredCourseId && idMap.has(hoveredCourseId)) {
        // Recursive DFS helper
        const traverse = (currentId: string, visited: Set<string>, graph: Record<string, string[]>) => {
            const neighbors = graph[currentId] || [];
            neighbors.forEach(nId => {
                if (!visited.has(nId)) {
                    visited.add(nId);
                    traverse(nId, visited, graph);
                }
            });
        };

        // Downstream (Post-reqs)
        traverse(hoveredCourseId, descendants, adj);
        // Upstream (Pre-reqs)
        traverse(hoveredCourseId, ancestors, revAdj);
        // Co-req Cluster (Recursive because A=B, B=C => A=C)
        traverse(hoveredCourseId, coreqs, coreqAdj);
    }

    return { 
        processedEdges: edgesList,
        highlightState: { ancestors, descendants, coreqs },
        courseBlockMap: blockMap
    };
  }, [targetCourses, hoveredCourseId, generalInfo.moetInfo.subBlocks]);

  const getDependencyStatus = (course: Course) => {
    if (!hoveredCourseId) return 'normal';
    if (course.id === hoveredCourseId) return 'active';
    if (highlightState.coreqs.has(course.id)) return 'coreq';
    if (highlightState.ancestors.has(course.id)) return 'prerequisite';
    if (highlightState.descendants.has(course.id)) return 'dependent';
    return 'faded';
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomSensitivity = 0.001;
      const delta = -e.deltaY * zoomSensitivity;
      const newScale = Math.min(Math.max(0.2, transform.scale + delta), 2);
      setTransform(prev => ({ ...prev, scale: newScale }));
    } else {
      setTransform(prev => ({ ...prev, x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only start panning if not clicking on a card
    if ((e.target as HTMLElement).closest('.course-card')) return;
    if ((e.target as HTMLElement).closest('.elective-block')) return;
    
    setIsPanning(true);
    setStartPan({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    if(containerRef.current) containerRef.current.style.cursor = 'grabbing';
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    e.preventDefault();
    setTransform(prev => ({
      ...prev,
      x: e.clientX - startPan.x,
      y: e.clientY - startPan.y
    }));
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    if(containerRef.current) containerRef.current.style.cursor = 'grab';
  };

  const resetView = () => setTransform({ x: 0, y: 0, scale: 1 });
  const zoomIn = () => setTransform(prev => ({ ...prev, scale: Math.min(prev.scale + 0.1, 2) }));
  const zoomOut = () => setTransform(prev => ({ ...prev, scale: Math.max(prev.scale - 0.1, 0.2) }));

  const exportImage = async () => {
    const element = document.getElementById('flowchart-content');
    if (!element) return;
    try {
      const currentTransform = { ...transform };
      setTransform({ x: 0, y: 0, scale: 1 });
      await new Promise(resolve => setTimeout(resolve, 100));
      const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#f8fafc', useCORS: true });
      const link = document.createElement('a');
      link.download = `flowchart_${state.generalInfo.programName.en}_${Date.now()}.png`;
      link.href = canvas.toDataURL();
      link.click();
      setTransform(currentTransform);
    } catch (err) {
      console.error(err);
      alert("Failed to export image.");
    }
  };

  // --- Dynamic Routing Engine with Jump Logic ---
  const layoutData = useMemo(() => {
    // 0. Sort Edges for Deterministic Routing
    const edges = [...processedEdges].sort((a, b) => {
        if (a.source.colIndex !== b.source.colIndex) return a.source.colIndex - b.source.colIndex;
        return a.target.colIndex - b.target.colIndex;
    });

    // 1. Separate Edges into Categories
    const gridEdges = edges.filter(e => !courseBlockMap.has(e.source.id) && !courseBlockMap.has(e.target.id));
    const blockEdges = edges.filter(e => courseBlockMap.has(e.source.id) || courseBlockMap.has(e.target.id));

    // 2. Determine Grid Positions and Lanes
    const colGapCounts: number[] = new Array(12).fill(0); 
    const rowGapCounts: Record<number, number> = {}; 
    const edgeMeta: Record<string, any> = {};

    gridEdges.forEach(edge => {
        const s = edge.source;
        const t = edge.target;
        let blocked = false;
        if (t.semester > s.semester + 1) blocked = true;

        if (!blocked) {
            // Adjacent Semesters (Z-Shape potential)
            if (s.colIndex !== t.colIndex) {
                if (!rowGapCounts[s.semester]) rowGapCounts[s.semester] = 0;
                const hLane = rowGapCounts[s.semester]++;
                edgeMeta[edge.id] = { type: 'z', hLane };
            } else {
                edgeMeta[edge.id] = { type: 'direct' }; 
            }
        } else {
            // Long Jump (Channel Routing)
            let gapIdx = Math.max(s.colIndex, t.colIndex);
            if (gapIdx > 9) gapIdx = 9;
            const vLane = colGapCounts[gapIdx]++;
            
            if (!rowGapCounts[s.semester]) rowGapCounts[s.semester] = 0;
            const hLaneOut = rowGapCounts[s.semester]++;

            const targetGapRow = t.semester - 1;
            if (!rowGapCounts[targetGapRow]) rowGapCounts[targetGapRow] = 0;
            const hLaneIn = rowGapCounts[targetGapRow]++;

            edgeMeta[edge.id] = { type: 'channel', gapIdx, vLane, hLaneOut, hLaneIn };
        }
    });

    // 3. Calculate Physical Coordinates for Main Grid
    let currentY = 0;
    const rowYPositions: Record<number, number> = {};
    for(let sem = 1; sem <= 9; sem++) {
        rowYPositions[sem] = currentY;
        const count = rowGapCounts[sem] || 0;
        const gapHeight = Math.max(BASE_ROW_GAP, (count * LANE_SPACING) + 40); 
        currentY += CARD_HEIGHT + gapHeight;
    }

    let currentX = SIDE_GAP + SEM_LABEL_WIDTH;
    const colXPositions: number[] = [];
    for(let col = 0; col < 12; col++) {
        colXPositions[col] = currentX;
        const count = colGapCounts[col] || 0;
        const gapWidth = BASE_COL_GAP + (count * LANE_SPACING);
        currentX += CARD_WIDTH + gapWidth;
    }

    // 4. Determine Block Edge Tracks
    // Sort block edges to optimize routing (source Y then target Y)
    blockEdges.sort((a, b) => {
        if (a.source.semester !== b.source.semester) return a.source.semester - b.source.semester;
        return a.target.semester - b.target.semester;
    });
    
    // Assign a unique vertical track in the "Elective Gap" for each block edge
    const blockEdgeTracks: Record<string, number> = {};
    blockEdges.forEach((e, idx) => {
        blockEdgeTracks[e.id] = idx;
    });
    
    const maxBlockTracks = blockEdges.length;
    // Dynamic gap width based on number of tracks
    const dynamicElectiveZoneGap = Math.max(100, maxBlockTracks * LANE_SPACING + 40);
    const electiveZoneX = currentX + dynamicElectiveZoneGap;

    // 5. Elective Block Coordinates
    const blockYPositions: Record<string, number> = {};
    const blockLayouts: { id: string, idealY: number, height: number }[] = [];
    const BLOCK_GAP = 40;

    (generalInfo.moetInfo.subBlocks || []).forEach(sb => {
        const coursesInBlock = sb.courseIds.map(cid => targetCourses.find(c => c.id === cid)).filter(Boolean) as Course[];
        if (coursesInBlock.length === 0) return;

        let minSem = 99;
        coursesInBlock.forEach(c => {
            if (c.semester < minSem) minSem = c.semester;
        });
        if (minSem === 99) minSem = 1;
        const idealY = rowYPositions[minSem] || 0;
        const height = 40 + (coursesInBlock.length * (CARD_HEIGHT + 10)) + 20;
        blockLayouts.push({ id: sb.id, idealY, height });
    });

    blockLayouts.sort((a, b) => a.idealY - b.idealY);
    let currentBottomY = 0; 
    blockLayouts.forEach(block => {
        let finalY = block.idealY;
        if (finalY < currentBottomY + BLOCK_GAP) {
            finalY = currentBottomY + BLOCK_GAP;
        }
        blockYPositions[block.id] = finalY;
        currentBottomY = finalY + block.height;
    });

    const totalWidth = electiveZoneX + ELECTIVE_BLOCK_WIDTH + SIDE_GAP;
    const maxBlockBottom = currentBottomY + 100;
    const totalHeight = Math.max(currentY + CARD_HEIGHT, maxBlockBottom);

    // Helpers
    const getCourseCoords = (c: Course) => {
        const blockId = courseBlockMap.get(c.id);
        if (blockId) {
            const blockY = blockYPositions[blockId] || 0;
            const sb = generalInfo.moetInfo.subBlocks?.find(b => b.id === blockId);
            const idx = sb?.courseIds.indexOf(c.id) || 0;
            const x = electiveZoneX + ELECTIVE_BLOCK_WIDTH / 2;
            const y = blockY + 40 + (idx * (CARD_HEIGHT + 10)) + CARD_HEIGHT / 2; 
            return { x, y };
        } else {
            const x = colXPositions[c.colIndex] + CARD_WIDTH / 2;
            return { x, y: rowYPositions[c.semester] + CARD_HEIGHT };
        }
    };
    
    const getTargetCoords = (c: Course) => {
        const blockId = courseBlockMap.get(c.id);
        if (blockId) {
             const blockY = blockYPositions[blockId] || 0;
             const sb = generalInfo.moetInfo.subBlocks?.find(b => b.id === blockId);
             const idx = sb?.courseIds.indexOf(c.id) || 0;
             const x = electiveZoneX + ELECTIVE_BLOCK_WIDTH / 2;
             const y = blockY + 40 + (idx * (CARD_HEIGHT + 10)); 
             return { x, y };
        } else {
             const x = colXPositions[c.colIndex] + CARD_WIDTH / 2;
             const y = rowYPositions[c.semester];
             return { x, y };
        }
    };

    // 6. Generate Paths
    const rawPaths: { id: string, points: Point[], source: Course, target: Course }[] = [];
    
    edges.forEach(edge => {
        const { source, target, id } = edge;
        const meta = edgeMeta[id];
        
        const start = getCourseCoords(source);
        const end = getTargetCoords(target);
        
        const sBlock = courseBlockMap.get(source.id);
        const tBlock = courseBlockMap.get(target.id);

        const points: Point[] = [];
        points.push(start);

        if (sBlock || tBlock) {
            // Block Routing with Dedicated Tracks
            // Calculate dedicated track X coordinate in the Elective Gap
            const trackIdx = blockEdgeTracks[id] || 0;
            // Gap starts after the last grid column + padding
            const gapStartX = currentX + 20; 
            const trackX = gapStartX + (trackIdx * LANE_SPACING);

            // Path: Start -> Horizontal to Track -> Vertical to Target Y -> Horizontal to Target
            // Important: Handle 'start' being inside a block (reverse direction) or main grid
            
            // Standard Case: Grid -> Block
            // Start (Grid bottom) -> Down slightly -> Right to Track -> Down/Up to Target Y -> Right to Block
            
            // Refined Points:
            // 1. Initial vertical offset from card
            points.push({ x: start.x, y: start.y + 10 }); 
            // 2. Horizontal to Track
            points.push({ x: trackX, y: start.y + 10 });
            // 3. Vertical along Track to target height
            // Target entering point is top of card, let's aim for slightly above it
            const targetEntryY = end.y - 10;
            points.push({ x: trackX, y: targetEntryY });
            // 4. Horizontal to Target
            points.push({ x: end.x, y: targetEntryY });
            
        } else {
            // Standard Grid Routing
            if (meta?.type === 'z') {
                const { hLane } = meta;
                const gapStartY = start.y + 10; 
                const hY = gapStartY + (hLane * LANE_SPACING);
                points.push({ x: start.x, y: hY });
                points.push({ x: end.x, y: hY });
            } else if (meta?.type === 'channel') {
                const { gapIdx, vLane, hLaneOut, hLaneIn } = meta;
                const colEnd = colXPositions[gapIdx] + CARD_WIDTH;
                const vX = colEnd + 20 + (vLane * LANE_SPACING);
                const gapOutY = start.y + 10;
                const hYOut = gapOutY + (hLaneOut * LANE_SPACING);
                const hYIn = end.y - 10 - (hLaneIn * LANE_SPACING);

                points.push({ x: start.x, y: hYOut });
                points.push({ x: vX, y: hYOut });
                points.push({ x: vX, y: hYIn });
                points.push({ x: end.x, y: hYIn });
            }
        }

        points.push(end);
        rawPaths.push({ id, points, source, target });
    });

    // 7. Extract Vertical Segments & Generate Final SVG Paths with Jumps
    const verticalSegments: VerticalSegment[] = [];
    rawPaths.forEach(path => {
        for (let i = 0; i < path.points.length - 1; i++) {
            const p1 = path.points[i];
            const p2 = path.points[i+1];
            if (Math.abs(p1.x - p2.x) < 0.1) { // Vertical
                verticalSegments.push({
                    x: p1.x,
                    yMin: Math.min(p1.y, p2.y),
                    yMax: Math.max(p1.y, p2.y),
                    id: path.id
                });
            }
        }
    });

    const finalPaths = rawPaths.map(path => {
        let d = `M ${path.points[0].x} ${path.points[0].y}`;
        
        for (let i = 0; i < path.points.length - 1; i++) {
            const p1 = path.points[i];
            const p2 = path.points[i+1];
            
            if (Math.abs(p1.y - p2.y) < 0.1) { // Horizontal
                const y = p1.y;
                const leftX = Math.min(p1.x, p2.x);
                const rightX = Math.max(p1.x, p2.x);
                const direction = p2.x > p1.x ? 1 : -1;

                const intersections = verticalSegments
                    .filter(v => v.id !== path.id)
                    .filter(v => v.x > leftX + JUMP_RADIUS && v.x < rightX - JUMP_RADIUS)
                    .filter(v => y > v.yMin && y < v.yMax)
                    .map(v => v.x);
                
                if (direction === 1) intersections.sort((a, b) => a - b);
                else intersections.sort((a, b) => b - a);

                let currentX = p1.x;
                intersections.forEach(ix => {
                    const jumpStart = ix - (JUMP_RADIUS * direction);
                    const jumpEnd = ix + (JUMP_RADIUS * direction);
                    d += ` L ${jumpStart} ${y}`;
                    const sweep = direction === 1 ? 1 : 0; 
                    d += ` A ${JUMP_RADIUS} ${JUMP_RADIUS} 0 0 ${sweep} ${jumpEnd} ${y}`;
                    currentX = jumpEnd;
                });
                d += ` L ${p2.x} ${p2.y}`;
            } else {
                d += ` L ${p2.x} ${p2.y}`;
            }
        }
        return { ...path, d };
    });

    return { colXPositions, rowYPositions, blockYPositions, electiveZoneX, totalWidth, totalHeight, finalPaths };
  }, [targetCourses, processedEdges, courseBlockMap, generalInfo.moetInfo.subBlocks]);

  return (
    <div className="h-full flex flex-col relative bg-slate-100 overflow-hidden">
      
      {/* Floating Toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-white p-1.5 rounded-xl shadow-xl border border-slate-200 flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <div className="flex bg-slate-100 p-0.5 rounded-lg mr-2">
                <button 
                    onClick={() => setStatsScope('abet')} 
                    className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all flex items-center gap-1 ${statsScope === 'abet' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Filter size={12}/> ABET
                </button>
                <button 
                    onClick={() => setStatsScope('all')} 
                    className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all ${statsScope === 'all' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    {language === 'vi' ? 'Toàn bộ' : 'All'}
                </button>
          </div>

          <div className="w-px h-6 bg-slate-200 mx-1"></div>
          
          <button onClick={() => setIsMinimalMode(!isMinimalMode)} className={`p-2 rounded-lg transition-colors ${isMinimalMode ? 'bg-indigo-100 text-indigo-600' : 'text-slate-600 hover:bg-slate-100'}`} title={language === 'vi' ? 'Chế độ tối giản' : 'Minimalist Mode'}>
             {isMinimalMode ? <Layout size={18} /> : <Minimize2 size={18} />}
          </button>

          <div className="w-px h-6 bg-slate-200 mx-1"></div>
          
          <button onClick={zoomOut} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"><ZoomOut size={18} /></button>
          <span className="text-xs font-bold text-slate-500 w-12 text-center">{Math.round(transform.scale * 100)}%</span>
          <button onClick={zoomIn} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"><ZoomIn size={18} /></button>
          <button onClick={resetView} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg" title="Reset View"><RotateCcw size={18} /></button>
          
          <div className="w-px h-6 bg-slate-200 mx-1"></div>
          <button onClick={exportImage} className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg" title={t.exportImage}>
             <Image size={18} />
          </button>
      </div>

      {/* Legend */}
      <div className="absolute top-4 right-4 z-50 bg-white/90 backdrop-blur-sm p-3 rounded-xl shadow-sm border border-slate-200 text-[10px] font-bold text-slate-600 flex flex-col gap-2">
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm border border-slate-300 bg-white"></span> {t.legendR}</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm border border-blue-200 bg-blue-50"></span> {t.legendSE}</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm border border-green-200 bg-green-50"></span> {t.legendE}</div>
        <div className="h-px bg-slate-200 my-1"></div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full border-2 border-amber-400 bg-white"></span> {t.prereqLegend}</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full border-2 border-emerald-500 bg-white"></span> {t.postreqLegend}</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full border-2 border-indigo-400 bg-white"></span> {language === 'vi' ? 'Song hành (Coreq)' : 'Co-requisite'}</div>
      </div>

      {/* Infinite Canvas */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-hidden relative cursor-grab bg-slate-50"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <div 
            className="absolute inset-0 pointer-events-none opacity-10"
            style={{
                backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)',
                backgroundSize: `${20 * transform.scale}px ${20 * transform.scale}px`,
                backgroundPosition: `${transform.x}px ${transform.y}px`
            }}
        />

        <div 
            id="flowchart-content"
            className="origin-top-left absolute transition-transform duration-75 ease-linear will-change-transform"
            style={{ 
                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                width: layoutData.totalWidth, 
                height: layoutData.totalHeight 
            }}
        >
            {/* Connection Lines (SVG) */}
            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
                <defs>
                  <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                    <path d="M 0 0 L 6 3 L 0 6 z" fill="#cbd5e1" />
                  </marker>
                  <marker id="arrowhead-active" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                    <path d="M 0 0 L 6 3 L 0 6 z" fill="#6366f1" />
                  </marker>
                  <marker id="arrowhead-pre" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                    <path d="M 0 0 L 6 3 L 0 6 z" fill="#f59e0b" />
                  </marker>
                </defs>
                {layoutData.finalPaths.map(path => {
                    const sId = path.source.id;
                    const tId = path.target.id;
                    
                    let stroke = "#cbd5e1";
                    let strokeWidth = 1.5;
                    let marker = "url(#arrowhead)";
                    let opacity = 1;

                    if (hoveredCourseId) {
                        const isRelevant = 
                            (sId === hoveredCourseId && highlightState.descendants.has(tId)) ||
                            (highlightState.descendants.has(sId) && highlightState.descendants.has(tId)) ||
                            (highlightState.ancestors.has(sId) && tId === hoveredCourseId) ||
                            (highlightState.ancestors.has(sId) && highlightState.ancestors.has(tId));

                        if (isRelevant) {
                            const isDownstream = highlightState.descendants.has(tId) || sId === hoveredCourseId;
                            stroke = isDownstream ? "#10b981" : "#f59e0b";
                            strokeWidth = 2.5;
                            marker = isDownstream ? "url(#arrowhead-active)" : "url(#arrowhead-pre)";
                            opacity = 1;
                        } else {
                            opacity = 0.1;
                        }
                    }

                    return (
                      <path 
                        key={path.id}
                        d={path.d}
                        fill="none"
                        stroke={stroke}
                        strokeWidth={strokeWidth}
                        markerEnd={marker}
                        opacity={opacity}
                        style={{ transition: 'stroke 0.2s, opacity 0.2s' }}
                      />
                    );
                })}
            </svg>

            {/* Render Semesters & Main Grid Courses */}
            {semesters.map(sem => {
                const yPos = layoutData.rowYPositions[sem];

                return (
                    <div key={sem} style={{ position: 'absolute', top: yPos, left: 0, right: 0, height: CARD_HEIGHT }}>
                        <div 
                            className="absolute left-0 top-0 bottom-0 flex items-center justify-center font-black text-slate-300 text-[40px] select-none z-0"
                            style={{ width: SIDE_GAP + SEM_LABEL_WIDTH }}
                        >
                            {sem}
                        </div>
                        
                        <div className="absolute left-[60px] right-0 top-1/2 h-px bg-slate-100 -z-10 border-t border-dashed border-slate-200"></div>

                        {Array.from({ length: 12 }).map((_, colIdx) => {
                            const course = targetCourses.find(c => c.semester === sem && c.colIndex === colIdx && !courseBlockMap.has(c.id));
                            const xPos = layoutData.colXPositions[colIdx];
                            const status = course ? getDependencyStatus(course) : 'normal';

                            return (
                                <div 
                                    key={colIdx}
                                    className={`absolute transition-colors duration-200 rounded-xl`}
                                    style={{ left: xPos, width: CARD_WIDTH, height: CARD_HEIGHT }}
                                >
                                    {course && (
                                        <div 
                                            onDoubleClick={() => onCourseNavigate(course.id)}
                                            onMouseEnter={() => setHoveredCourseId(course.id)}
                                            onMouseLeave={() => setHoveredCourseId(null)}
                                            className={`
                                                course-card w-full h-full p-3 rounded-xl border shadow-sm cursor-pointer transition-all duration-300 flex flex-col justify-between relative group
                                                ${STATUS_COLORS[course.type]}
                                                ${status === 'active' ? 'ring-4 ring-indigo-100 border-indigo-500 z-20 scale-105 shadow-xl' : ''}
                                                ${status === 'prerequisite' ? 'ring-4 ring-amber-100 border-amber-500 z-10' : ''}
                                                ${status === 'dependent' ? 'ring-4 ring-emerald-100 border-emerald-500 z-10' : ''}
                                                ${status === 'coreq' ? 'ring-4 ring-indigo-100 border-indigo-400 z-10' : ''}
                                                ${status === 'faded' ? 'opacity-20 grayscale blur-[1px]' : 'opacity-100'}
                                                hover:shadow-md hover:-translate-y-1
                                            `}
                                            title={`${course.name[language]}\nID: ${course.id}`}
                                        >
                                            {isMinimalMode ? (
                                              <div className="flex items-center justify-center h-full w-full">
                                                  <span className="text-2xl font-black tracking-tighter text-center leading-none select-none opacity-90">{course.code}</span>
                                              </div>
                                            ) : (
                                              <>
                                                <div className="flex justify-between items-start">
                                                    <span className="text-[11px] font-black tracking-tight">{course.code}</span>
                                                    <span className="text-[9px] font-bold bg-black/5 px-1.5 py-0.5 rounded text-slate-600">{course.credits} cr</span>
                                                </div>
                                                
                                                <div className="text-[10px] font-bold leading-tight line-clamp-2 opacity-90">
                                                    {course.name[language]}
                                                </div>
                                              </>
                                            )}

                                            {course.isEssential && (
                                                <div className="absolute -top-1.5 -right-1.5 bg-amber-400 text-white rounded-full p-0.5 shadow-sm">
                                                    <Maximize size={8} />
                                                </div>
                                            )}
                                            
                                            <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <MousePointer2 size={12} className="text-slate-400" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                );
            })}

            {/* Render Elective Sub-blocks (Right Side) */}
            {(generalInfo.moetInfo.subBlocks || []).map(sb => {
                const yPos = layoutData.blockYPositions[sb.id];
                if (yPos === undefined) return null;
                const coursesInBlock = sb.courseIds.map(cid => targetCourses.find(c => c.id === cid)).filter(Boolean) as Course[];
                if (coursesInBlock.length === 0) return null;

                const blockHeight = 40 + (coursesInBlock.length * (CARD_HEIGHT + 10));

                return (
                    <div 
                        key={sb.id} 
                        className="elective-block absolute rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/20"
                        style={{ 
                            left: layoutData.electiveZoneX, 
                            top: yPos, 
                            width: ELECTIVE_BLOCK_WIDTH, 
                            height: blockHeight 
                        }}
                    >
                        <div className="absolute -top-3 left-4 bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg text-xs font-bold shadow-sm flex items-center gap-2 border border-indigo-200">
                            <Layers size={12}/> {sb.name[language]}
                        </div>
                        <div className="absolute top-2 right-2 text-[10px] font-bold text-indigo-400 bg-white/50 px-2 py-0.5 rounded">
                            Min: {sb.minCredits} cr
                        </div>

                        <div className="flex flex-col gap-[10px] p-[20px] pt-[40px]">
                            {coursesInBlock.map(course => {
                                const status = getDependencyStatus(course);
                                return (
                                    <div 
                                        key={course.id}
                                        onDoubleClick={() => onCourseNavigate(course.id)}
                                        onMouseEnter={() => setHoveredCourseId(course.id)}
                                        onMouseLeave={() => setHoveredCourseId(null)}
                                        className={`
                                            course-card w-full h-[80px] p-3 rounded-xl border shadow-sm cursor-pointer transition-all duration-300 flex flex-col justify-between relative group
                                            ${STATUS_COLORS[course.type]}
                                            ${status === 'active' ? 'ring-4 ring-indigo-100 border-indigo-500 z-20 scale-105 shadow-xl' : ''}
                                            ${status === 'prerequisite' ? 'ring-4 ring-amber-100 border-amber-500 z-10' : ''}
                                            ${status === 'dependent' ? 'ring-4 ring-emerald-100 border-emerald-500 z-10' : ''}
                                            ${status === 'coreq' ? 'ring-4 ring-indigo-100 border-indigo-400 z-10' : ''}
                                            ${status === 'faded' ? 'opacity-20 grayscale blur-[1px]' : 'opacity-100'}
                                            hover:shadow-md hover:-translate-x-1
                                        `}
                                    >
                                        {isMinimalMode ? (
                                            <div className="flex items-center justify-center h-full w-full">
                                                <span className="text-xl font-black tracking-tighter text-center leading-none select-none opacity-90">{course.code}</span>
                                            </div>
                                        ) : (
                                            <>
                                            <div className="flex justify-between items-start">
                                                <span className="text-[11px] font-black tracking-tight">{course.code}</span>
                                                <span className="text-[9px] font-bold bg-black/5 px-1.5 py-0.5 rounded text-slate-600">{course.credits} cr</span>
                                            </div>
                                            
                                            <div className="text-[10px] font-bold leading-tight line-clamp-2 opacity-90">
                                                {course.name[language]}
                                            </div>
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
      </div>
    </div>
  );
};

export default FlowchartModule;
