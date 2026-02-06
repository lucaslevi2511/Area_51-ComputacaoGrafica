// Função de parsing de arquivos .obj (Talvez seja presico acrescentar o parsing de arquivo .mtl)
export function parseOBJ(text) {
    const objPositions = [[0, 0, 0]];
    const objTexcoords = [[0, 0]];
    const objNormals = [[0, 0, 0]];
    const objVertexData = [objPositions, objTexcoords, objNormals];
    let webglVertexData = [[], [], []];
    const materialLibs = [];
    const geometries = [];
    let geometry, groups = ['default'], material = 'default', object = 'default';

    const newGeometry = () => { if (geometry && geometry.data.position.length) geometry = undefined; };

    function setGeometry() {
        if (!geometry) {
            const position = [], texcoord = [], normal = [];
            webglVertexData = [position, texcoord, normal];
            geometry = { object, groups, material, data: { position, texcoord, normal } };
            geometries.push(geometry);
        }
    }

    function addVertex(vert) {
        const ptn = vert.split('/');
        ptn.forEach((objIndexStr, i) => {
            if (!objIndexStr) return;
            const objIndex = parseInt(objIndexStr);
            const index = objIndex + (objIndex >= 0 ? 0 : objVertexData[i].length);
            webglVertexData[i].push(...objVertexData[i][index]);
        });
    }

    const keywords = {
        v(parts) { objPositions.push(parts.map(parseFloat)); },
        vn(parts) { objNormals.push(parts.map(parseFloat)); },
        vt(parts) { objTexcoords.push(parts.map(parseFloat)); },
        f(parts) {
            setGeometry();
            for (let tri = 0; tri < parts.length - 2; ++tri) {
                addVertex(parts[0]); addVertex(parts[tri + 1]); addVertex(parts[tri + 2]);
            }
        },
        mtllib(p, unparsed) { materialLibs.push(unparsed); },
        usemtl(p, unparsed) { material = unparsed; newGeometry(); },
        g(parts) { groups = parts; newGeometry(); },
        o(p, unparsed) { object = unparsed; newGeometry(); },
        s: () => {}
    };

    text.split('\n').forEach(line => {
        const l = line.trim();
        if (l === '' || l.startsWith('#')) return;
        const m = /(\w*)(?: )*(.*)/.exec(l);
        if (!m) return;
        const [, keyword, unparsedArgs] = m;
        const parts = l.split(/\s+/).slice(1);
        if (keywords[keyword]) keywords[keyword](parts, unparsedArgs);
    });

    return { geometries, materialLibs };
} 