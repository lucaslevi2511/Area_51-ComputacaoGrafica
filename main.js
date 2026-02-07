// É a main, carrega os modelos, inicializa o WebGL e desenha a cena
import * as Utils from './webgl-utils.js';
import { parseOBJ } from './obj-parser.js';
import { createRenderable } from './renderer.js';
import * as Math3D from './math.js';
import { createExhibitCorridor } from './geometry-generator.js';

// Estado Global
let gl, prog, lightProg;
let sceneObjects = [];
let angle = 0;
const arquivos = ["obj/sun.obj", "obj/pucci.obj"];
const texSrc = ["img/textura_sol.jpg", "img/pucci.png"];

async function init() {
    const modelTexts = await Promise.all(arquivos.map(url => fetch(url).then(r => r.text())));
    const loadedImages = await Promise.all(texSrc.map(url => Utils.loadImage(url)));

    const metalImgElement = await Utils.loadImage("img/metal.jpg"); //Carregando a imagem da sala separadamente

    initGL();

    const modelParsers = modelTexts.map(text => parseOBJ(text));

    const textureLibrary = loadedImages.map(img => Utils.createWebGLTexture(gl, img)); 

    const metalTexture = Utils.createWebGLTexture(gl, metalImgElement);  // Textura do metal carregada separadamente

    const corridor = createExhibitCorridor(gl);
    corridor.isLightSource = false;
    corridor.transform.y = -15.0; // Ajuste para ficar abaixo dos objetos
    corridor.texture = metalTexture;// metal.jpg
    sceneObjects.push(corridor);

    modelParsers.forEach((dados, mIndex) => {
        dados.geometries.forEach((geom, gIndex) => {
            if (!geom.data.position) return;
            const obj = createRenderable(gl, geom);

            // Calcula o centro geométrico real do objeto (o "erro" de exportação)
            const center = Utils.getBoundingBoxCenter(geom.data.position);
            obj.centerCorrection = { x: -center.x, y: -center.y, z: -center.z };

            console.log("Centro calculado:", center);
            
            switch(mIndex){ //Switch case com base na posição do index
                case 0:
                    obj.isLightSource = true;
                    obj.transform.scale = 0.01;
                    break

                case 1:
                    obj.isLightSource = false;
                    obj.transform.scale = 5;
                    obj.transform.x = 23;
                    obj.transform.z = 0;
                    obj.transform.ry = -100;
                    break
            }
            obj.texture = textureLibrary[mIndex];
            sceneObjects.push(obj);
        });
    });

    draw();
}

function initGL() {
    const canvas = document.getElementById("glcanvas1");
    gl = Utils.getGL(canvas);
    
    const vtxShSrc = document.getElementById("vertex-shader").text;
    const fragShSrc = document.getElementById("frag-shader").text;
    const lightFragSrc = `precision mediump float; varying vec2 v_texCoord; uniform sampler2D tex; void main() { gl_FragColor = texture2D(tex, v_texCoord); }`;

    const vShader = Utils.createShader(gl, gl.VERTEX_SHADER, vtxShSrc);
    const fShader = Utils.createShader(gl, gl.FRAGMENT_SHADER, fragShSrc);
    const lFShader = Utils.createShader(gl, gl.FRAGMENT_SHADER, lightFragSrc);

    prog = Utils.createProgram(gl, vShader, fShader);
    lightProg = Utils.createProgram(gl, vShader, lFShader);

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST);
}

function draw() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    angle++;

    const sun_angle = angle ** 0.5;
    const radius = 10000;
    const lx = Math.cos(sun_angle) * radius;
    const ly = Math.sin(sun_angle) * radius;
    const lz = 0.0;

    const aspect = gl.canvas.width / gl.canvas.height;
    const projectionMatrix = Math3D.createPerspective(60, aspect, 0.1, 2000);
    const eye = [0, 10, 0], target = [10, 5, 0], up = [0, 1, 0];
    const viewMatrix = Math3D.lookat(eye, target, up);

    sceneObjects.forEach(obj => {
        const currentProgram = obj.isLightSource ? lightProg : prog;
        gl.useProgram(currentProgram);

        gl.uniformMatrix4fv(gl.getUniformLocation(currentProgram, "projection"), false, projectionMatrix);
        gl.uniformMatrix4fv(gl.getUniformLocation(currentProgram, "view"), false, viewMatrix);

        // Atributos de Posição
        gl.bindBuffer(gl.ARRAY_BUFFER, obj.buffer);
        const posPtr = gl.getAttribLocation(currentProgram, "position");
        if(posPtr !== -1) {
            gl.enableVertexAttribArray(posPtr);
            gl.vertexAttribPointer(posPtr, 3, gl.FLOAT, false, 0, 0);
        }

        if(!obj.isLightSource) {
            const normLoc = gl.getAttribLocation(currentProgram, "normal");
            if(normLoc !== -1) {
                gl.bindBuffer(gl.ARRAY_BUFFER, obj.normalBuffer);
                gl.enableVertexAttribArray(normLoc);
                gl.vertexAttribPointer(normLoc, 3, gl.FLOAT, false, 0, 0);
            }
            gl.uniform3f(gl.getUniformLocation(currentProgram, "u_lightPosStatic"), 20, 50, 40);
            gl.uniform3f(gl.getUniformLocation(currentProgram, "u_lightPosDynamic"), lx, ly, lz);
            gl.uniform3f(gl.getUniformLocation(currentProgram, "u_viewPosition"), eye[0], eye[1], eye[2]);

            //obj.transform.ry = angle;
        } else {
            obj.transform.x = lx; obj.transform.y = ly; obj.transform.z = lz;
        }

        // Texturas
        const texLoc = gl.getAttribLocation(currentProgram, "texCoord");
        if (obj.bufferTexCoord && texLoc !== -1) {
            gl.bindBuffer(gl.ARRAY_BUFFER, obj.bufferTexCoord);
            gl.enableVertexAttribArray(texLoc);
            gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, obj.texture);
            gl.uniform1i(gl.getUniformLocation(currentProgram, "tex"), 0);
        }

        // Matriz de Modelo
        const matS = Math3D.scaleMatrix(obj.transform.scale, obj.transform.scale, obj.transform.scale);
        let rotationY = obj.transform.ry || 0; 

        if (!obj.isLightSource && obj !== sceneObjects[0]) { // Exemplo: Girar tudo que não for luz e não for o corredor
            rotationY = angle; // Velocidade do giro
        }

        const matR_Y = obj.isLightSource ? [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1] : Math3D.rotateY(rotationY);
        const matT = Math3D.translationMatrix(obj.transform.x, obj.transform.y, obj.transform.z);
        
        const matRS = Math3D.multiply(matR_Y, matS);

        const modelMatrix = Math3D.multiply(matRS, matT);
        
        gl.uniformMatrix4fv(gl.getUniformLocation(currentProgram, "transf"), false, modelMatrix);
        
        gl.drawArrays(gl.TRIANGLES, 0, obj.numVertices);
    });

    requestAnimationFrame(draw);
}

// Inicia o app
window.onload = init;