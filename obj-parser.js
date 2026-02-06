export function parseOBJ(text) {
    // Listas auxiliares (OBJ é 1-indexed, então começamos com dummy values ou ajustamos no índice)
    const positions = [];
    const texcoords = [];
    const normals = [];
    
    // Resultado final
    const geometries = [];
    const materialLibs = [];

    // Estado atual do parser
    let currentObject = 'default';
    let currentGroups = ['default'];
    let currentMaterial = 'default';
    let currentGeometry = null;

    // Função interna para inicializar uma nova geometria apenas quando necessário
    function initGeometry() {
        if (!currentGeometry) {
            currentGeometry = {
                object: currentObject,
                groups: currentGroups,
                material: currentMaterial,
                data: { position: [], texcoord: [], normal: [] }
            };
            geometries.push(currentGeometry);
        }
    }

    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('#')) continue;

        const parts = line.split(/\s+/);
        const type = parts[0];
        const args = parts.slice(1);

        switch (type) {
            case 'v': // Vértices
                positions.push(args.map(Number));
                break;
            case 'vt': // Coordenadas de Textura
                texcoords.push(args.map(Number));
                break;
            case 'vn': // Normais
                normals.push(args.map(Number));
                break;
            case 'f': // Faces
                initGeometry();
                // Processa faces (suporta triângulos e polígonos maiores via fan-triangulation)
                for (let j = 0; j < args.length - 2; j++) {
                    const triangleVerts = [args[0], args[j + 1], args[j + 2]];
                    
                    triangleVerts.forEach(vertStr => {
                        const indices = vertStr.split('/');
                        
                        indices.forEach((idxStr, indexType) => {
                            if (!idxStr) return;
                            
                            const objIdx = parseInt(idxStr);
                            const sourceList = [positions, texcoords, normals][indexType];
                            
                            // Converte índice do OBJ (1-based ou negativo) para 0-based do JS
                            const finalIdx = objIdx >= 0 ? objIdx - 1 : sourceList.length + objIdx;
                            
                            const value = sourceList[finalIdx];
                            if (value) {
                                const targetKey = ['position', 'texcoord', 'normal'][indexType];
                                currentGeometry.data[targetKey].push(...value);
                            }
                        });
                    });
                }
                break;
            case 'mtllib':
                materialLibs.push(args.join(' '));
                break;
            case 'usemtl':
                currentMaterial = args.join(' ');
                currentGeometry = null; // Força criação de nova geometria
                break;
            case 'o':
                currentObject = args.join(' ');
                currentGeometry = null;
                break;
            case 'g':
                currentGroups = args;
                currentGeometry = null;
                break;
        }
    }

    return { geometries, materialLibs };
}