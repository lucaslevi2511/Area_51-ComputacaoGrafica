import { createRenderable } from './renderer.js';

export function createExhibitCorridor(gl) {
    const positions = [];
    const normals = [];
    const texcoords = [];
    // a variável 'n' é o vetor normmal das paredes, decidi deixar n porque 'normal' fica difícil de separar de 'normals'
    function addQuad(p1, p2, p3, p4, n) {
        positions.push(...p1, ...p2, ...p3, ...p1, ...p3, ...p4);
        for(let i=0; i<6; i++) normals.push(...n);
        texcoords.push(0,0, 1,0, 1,1, 0,0, 1,1, 0,1);
    }

    const length = 100.0; 
    const width = 20.0;  
    const height = 30.0; 
    const holeSize = 20.0; 
    const holeDepth = 20.0; 
    const hBottom = 5.0; 
    const hTop = hBottom + holeSize;

    // Chão
    addQuad([-width, 0, -length], [width, 0, -length], [width, 0, length], [-width, 0, length], [0, 1, 0]);

    // Fundo e frente do corredor
    // Fundo
    addQuad([-width, 0, -length], [-width, height, -length], [width, height, -length], [width, 0, -length], [0, 0, 1]);
    // Frente
    addQuad([-width, 0, length], [width, 0, length], [width, height, length], [-width, height, length], [0, 0, -1]);

    // Paredes laterais comm buracos
    [-1, 1].forEach(side => {
        const x = width * side;
        const nWall = [-side, 0, 0]; // Normal apontando para dentro do corredor
        const nNicheSide = [side, 0, 0]; // Normal das laterais internas do nicho

        // Z-positions para os 3 buracos
        const holeZs = [];
        for (let i = 0; i < 3; i++) {
            const zCenter = -length + (i + 1) * (length * 2 / 4);
            holeZs.push({ start: zCenter - holeSize/2, end: zCenter + holeSize/2 });
        }

        // Construção da parede "Vazada"
        
        // Faixa debaixo dos buracos (de 0 até hBottom)
        addQuad([x, 0, -length], [x, 0, length], [x, hBottom, length], [x, hBottom, -length], nWall);

        // Faixa de cima dos buracos (de hTop até height)
        addQuad([x, hTop, -length], [x, hTop, length], [x, height, length], [x, height, -length], nWall);

        // Segmentos verticais entre/antes/depois dos buracos
        // 'hz' é o cenntro  de um dos buracos, assim como na variávell 'n' deixei assim porque achei menos confuso
        let lastZ = -length;
        holeZs.forEach(hz => {
            // Parede entre o último Z e o início do buraco atual
            if (hz.start > lastZ) {
                addQuad([x, hBottom, lastZ], [x, hBottom, hz.start], [x, hTop, hz.start], [x, hTop, lastZ], nWall);
            }

            // Construção do buraco
            const deepX = x + (holeDepth * side);

            // Fundo do nicho (paralelo à parede)
            addQuad([deepX, hBottom, hz.start], [deepX, hTop, hz.start], [deepX, hTop, hz.end], [deepX, hBottom, hz.end], nWall);
            
            // Teto do nicho
            addQuad([x, hTop, hz.start], [deepX, hTop, hz.start], [deepX, hTop, hz.end], [x, hTop, hz.end], [0, -1, 0]);
            
            // Chão do nicho
            addQuad([x, hBottom, hz.start], [x, hBottom, hz.end], [deepX, hBottom, hz.end], [deepX, hBottom, hz.start], [0, 1, 0]);
            
            // Lateral Esquerda do nicho (dentro do buraco)
            addQuad([x, hBottom, hz.start], [deepX, hBottom, hz.start], [deepX, hTop, hz.start], [x, hTop, hz.start], [0, 0, 1]);
            
            // Lateral Direita do nicho (dentro do buraco)
            addQuad([x, hBottom, hz.end], [x, hTop, hz.end], [deepX, hTop, hz.end], [deepX, hBottom, hz.end], [0, 0, -1]);

            lastZ = hz.end;
        });

        // Último pedaço de parede após o último buraco até o fim do corredor
        addQuad([x, hBottom, lastZ], [x, hBottom, length], [x, hTop, length], [x, hTop, lastZ], nWall);
    });

    return createRenderable(gl, { data: { position: positions, normal: normals, texcoord: texcoords } });
}