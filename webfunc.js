var sceneObjects = [];
var gl;
var prog;
var df = 2.0;

var angle = 0;

function getGL(canvas) {
  var gl = canvas.getContext("webgl");
  if (gl) return gl;

  gl = canvas.getContext("experimental-webgl");
  if (gl) return gl;

  alert("Contexto WebGL inexistente! Troque de navegador!");
  return false;
}

function createShader(gl, shaderType, shaderSrc) {
  var shader = gl.createShader(shaderType);
  gl.shaderSource(shader, shaderSrc);
  gl.compileShader(shader);

  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS))
    return shader;

  alert("Erro de compilação: " + gl.getShaderInfoLog(shader));

  gl.deleteShader(shader);
}

function createProgram(gl, vtxShader, fragShader) {
  var prog = gl.createProgram();
  gl.attachShader(prog, vtxShader);
  gl.attachShader(prog, fragShader);
  gl.linkProgram(prog);

  if (gl.getProgramParameter(prog, gl.LINK_STATUS))
    return prog;

  alert("Erro de linkagem: " + gl.getProgramInfoLog(prog));

  gl.deleteProgram(prog);
}

var modelData = null;

function parseOBJ(text) {
  // because indices are base 1 let's just fill in the 0th data
  const objPositions = [[0, 0, 0]];
  const objTexcoords = [[0, 0]];
  const objNormals = [[0, 0, 0]];

  // same order as `f` indices
  const objVertexData = [
    objPositions,
    objTexcoords,
    objNormals,
  ];

  // same order as `f` indices
  let webglVertexData = [
    [],   // positions
    [],   // texcoords
    [],   // normals
  ];

  const materialLibs = [];
  const geometries = [];
  let geometry;
  let groups = ['default'];
  let material = 'default';
  let object = 'default';

  const noop = () => { };

  function newGeometry() {
    // If there is an existing geometry and it's
    // not empty then start a new one.
    if (geometry && geometry.data.position.length) {
      geometry = undefined;
    }
  }

  function setGeometry() {
    if (!geometry) {
      const position = [];
      const texcoord = [];
      const normal = [];
      webglVertexData = [
        position,
        texcoord,
        normal,
      ];
      geometry = {
        object,
        groups,
        material,
        data: {
          position,
          texcoord,
          normal,
        },
      };
      geometries.push(geometry);
    }
  }

  function addVertex(vert) {
    const ptn = vert.split('/');
    ptn.forEach((objIndexStr, i) => {
      if (!objIndexStr) {
        return;
      }
      const objIndex = parseInt(objIndexStr);
      const index = objIndex + (objIndex >= 0 ? 0 : objVertexData[i].length);
      webglVertexData[i].push(...objVertexData[i][index]);
    });
  }

  const keywords = {
    v(parts) {
      objPositions.push(parts.map(parseFloat));
    },
    vn(parts) {
      objNormals.push(parts.map(parseFloat));
    },
    vt(parts) {
      // should check for missing v and extra w?
      objTexcoords.push(parts.map(parseFloat));
    },
    f(parts) {
      setGeometry();
      const numTriangles = parts.length - 2;
      for (let tri = 0; tri < numTriangles; ++tri) {
        addVertex(parts[0]);
        addVertex(parts[tri + 1]);
        addVertex(parts[tri + 2]);
      }
    },
    s: noop,    // smoothing group
    mtllib(parts, unparsedArgs) {
      // the spec says there can be multiple filenames here
      // but many exist with spaces in a single filename
      materialLibs.push(unparsedArgs);
    },
    usemtl(parts, unparsedArgs) {
      material = unparsedArgs;
      newGeometry();
    },
    g(parts) {
      groups = parts;
      newGeometry();
    },
    o(parts, unparsedArgs) {
      object = unparsedArgs;
      newGeometry();
    },
  };

  const keywordRE = /(\w*)(?: )*(.*)/;
  const lines = text.split('\n');
  for (let lineNo = 0; lineNo < lines.length; ++lineNo) {
    const line = lines[lineNo].trim();
    if (line === '' || line.startsWith('#')) {
      continue;
    }
    const m = keywordRE.exec(line);
    if (!m) {
      continue;
    }
    const [, keyword, unparsedArgs] = m;
    const parts = line.split(/\s+/).slice(1);
    const handler = keywords[keyword];
    if (!handler) {
      console.warn('unhandled keyword:', keyword);  // eslint-disable-line no-console
      continue;
    }
    handler(parts, unparsedArgs);
  }

  // remove any arrays that have no entries.
  for (const geometry of geometries) {
    geometry.data = Object.fromEntries(
      Object.entries(geometry.data).filter(([, array]) => array.length > 0));
  }

  return {
    geometries,
    materialLibs,
  };
}


function init() {
  // Lista de arquivos .obj para carregar
  const arquivos = ["FinalBaseMesh.obj", "cube.obj"]; 

  const promises = arquivos.map(url => 
    fetch(url)
      .then(res => res.text())
      .then(text => parseOBJ(text))
  );

  Promise.all(promises).then(modelosParsers => {
    initGL(); 
    modelosParsers.forEach((dados, index) => {
      let objeto = createRenderable(gl, dados);
      
      //Coloca um objeto do lado do outro, só pparaa teste
      objeto.transform.x = index * 6.0; 
      
      sceneObjects.push(objeto);
    });

    draw();
  });
}
function initGL() {

  var canvas = document.getElementById("glcanvas1");

  gl = getGL(canvas);
  if (gl) {
    //Inicializa shaders
    var vtxShSrc = document.getElementById("vertex-shader").text;
    var fragShSrc = document.getElementById("frag-shader").text;

    var vtxShader = createShader(gl, gl.VERTEX_SHADER, vtxShSrc);
    var fragShader = createShader(gl, gl.FRAGMENT_SHADER, fragShSrc);
    prog = createProgram(gl, vtxShader, fragShader);

    gl.useProgram(prog);

    //Inicializa área de desenho: viewport e cor de limpeza; limpa a tela
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);

  }
}
var numVertices = 0;

function createRenderable(gl, modelData) {
  const positions = modelData.geometries[0].data.position;
  
  if (!positions) {
    console.error("Dados de posição não encontrados!");
    return null;
  }
  var bufPtr = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, bufPtr);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  return {
    buffer: bufPtr,
    numVertices: positions.length / 3,
    transform: {
      x: 0.0, y: 0.0, z: 0.0,
      rx: 0.0, ry: 0.0, rz: 0.0,
      scale: 1.0
    }
  };
}

function multiply(a, b) {
  var c = new Float32Array(16);
  for (var i = 0; i < 4; i++) {
    for (var j = 0; j < 4; j++) {
      c[i * 4 + j] = a[i * 4 + 0] * b[0 * 4 + j] +
        a[i * 4 + 1] * b[1 * 4 + j] +
        a[i * 4 + 2] * b[2 * 4 + j] +
        a[i * 4 + 3] * b[3 * 4 + j];
    }
  }
  return c;
}

// Cria matriz de translação (tx, ty, tz)
function translationMatrix(tx, ty, tz) {
  return [
    1.0, 0.0, 0.0, 0.0,
    0.0, 1.0, 0.0, 0.0,
    0.0, 0.0, 1.0, 0.0,
    tx, ty, tz, 1.0
  ];
}

// Cria matriz de escala (sx, sy, sz)
function scaleMatrix(sx, sy, sz) {
  return [
    sx, 0.0, 0.0, 0.0,
    0.0, sy, 0.0, 0.0,
    0.0, 0.0, sz, 0.0,
    0.0, 0.0, 0.0, 1.0
  ];
}

// Rotação Eixo X
function rotateX(angle) {
  var rad = angle * Math.PI / 180.0;
  var c = Math.cos(rad);
  var s = Math.sin(rad);
  return [
    1.0, 0.0, 0.0, 0.0,
    0.0, c, s, 0.0,
    0.0, -s, c, 0.0,
    0.0, 0.0, 0.0, 1.0
  ];
}

// Rotação Eixo Y
function rotateY(angle) {
  var rad = angle * Math.PI / 180.0;
  var c = Math.cos(rad);
  var s = Math.sin(rad);
  return [
    c, 0.0, -s, 0.0,
    0.0, 1.0, 0.0, 0.0,
    s, 0.0, c, 0.0,
    0.0, 0.0, 0.0, 1.0
  ];
}

// Rotação Eixo Z
function rotateZ(angle) {
  var rad = angle * Math.PI / 180.0;
  var c = Math.cos(rad);
  var s = Math.sin(rad);
  return [
    c, s, 0.0, 0.0,
    -s, c, 0.0, 0.0,
    0.0, 0.0, 1.0, 0.0,
    0.0, 0.0, 0.0, 1.0
  ];
}

function createPerspective(fovy, aspect, near, far){
  fovy = fovy * Math.PI / 180.0;
  var fy = 1 / Math.tan(fovy / 2)
  var fx = fy / aspect
  var A = -(far+near)/ (far-near)
  var B = -2 * far * near / (far - near)

  var perspec = new Float32Array(
    [fx, 0, 0, 0],
     [0, fy, 0, 0],
     [0, 0, A, B],
     [0, 0, -1, 0]);

  return perspec
}

function draw() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  angle++; 

  var dfPtr = gl.getUniformLocation(prog, "df");
  gl.uniform1f(dfPtr, df); 

  sceneObjects.forEach(obj => {
    gl.bindBuffer(gl.ARRAY_BUFFER, obj.buffer);
    
    var positionPtr = gl.getAttribLocation(prog, "position");
    gl.enableVertexAttribArray(positionPtr); 

    gl.vertexAttribPointer(positionPtr, 3, gl.FLOAT, false, 0, 0);

    obj.transform.ry = angle; 
    obj.transform.scale = 1.0; 
    obj.transform.y= -10.0;
    var matS = scaleMatrix(obj.transform.scale, obj.transform.scale, obj.transform.scale);
    var matR_Y = rotateY(obj.transform.ry);
    var matT = translationMatrix(obj.transform.x, obj.transform.y, obj.transform.z);


    var matRS = multiply(matT, matR_Y); 
    var finalMatrix = multiply(matRS, matS); 

    var transfPtr = gl.getUniformLocation(prog, "transf");
    gl.uniformMatrix4fv(transfPtr, false, finalMatrix);
    
    gl.drawArrays(gl.TRIANGLES, 0, obj.numVertices);
  });

  requestAnimationFrame(draw);
}