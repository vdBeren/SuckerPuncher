/**
 * Notes:
 * - Coordinates are specified as (X, Y, Z) where X and Z are horizontal and Y
 *   is vertical
 */


var map = [ // 1  2  3  4  5  6  7  8  9
           [1, 1, 1, 1, 1, 1, 1, 1, 1, 1,], // 0
           [1, 1, 0, 0, 0, 0, 0, 1, 1, 1,], // 1
           [1, 1, 0, 0, 1, 0, 0, 0, 0, 1,], // 2
           [1, 0, 0, 0, 0, 1, 0, 0, 0, 1,], // 3
           [1, 0, 0, 1, 0, 0, 1, 0, 0, 1,], // 4
           [1, 0, 0, 0, 1, 0, 0, 0, 1, 1,], // 5
           [1, 1, 1, 0, 1, 0, 0, 1, 1, 1,], // 6
           [1, 1, 0, 0, 0, 1, 0, 0, 1, 1,], // 7
           [1, 1, 0, 0, 0, 0, 0, 0, 1, 1,], // 8
           [1, 1, 1, 0, 0, 0, 1, 1, 1, 1,], // 9
		   [1, 1, 1, 1, 1, 1, 1, 1, 1, 1,], // 10
           ], mapW = map.length, mapH = map[0].length;

// Semi-constants
var WIDTH = window.innerWidth,
	HEIGHT = window.innerHeight,
	ASPECT = WIDTH / HEIGHT,
	UNITSIZE = 250,
	WALLHEIGHT = UNITSIZE / 3,
	MOVESPEED = 100,
	LOOKSPEED = 0.075,
	BULLETMOVESPEED = MOVESPEED * 5,
	NUMAI = 5,
	PROJECTILEDAMAGE = 25;
// Global vars
var t = THREE, scene, cam, renderer, controls, clock, projector, model, skin;
var runAnim = true, mouse = { x: 0, y: 0 }, kills = 0, health = 100, multiplier = 1, score = 0;
var monsterHealth = 100, monsterType = 0;
var healthCube, lastHealthPickup = 0;

var loader = new t.JSONLoader(); // Inicia o utilitario para load de Models JSON


// Initialize and run on document ready
$(document).ready(function() {
	$('body').append('<div id="intro-history">SUCKER PUNCHER went to hell by mistake. Now guess who is getting punched?</div>');
	$('body').append('<div id="intro">GO PUNCH SOME DEMONS<br>[PUNCH with CLICK]<br>[MOVE wih AWSD]</div>');
	$('#intro').css({width: WIDTH, height: HEIGHT}).one('click', function(e) {
		e.preventDefault();
		$(this).fadeOut();
		$('#intro-history').fadeOut();
		init();
		setInterval(drawRadar, 1000);
		animate();
	});
	
	
});

	
// Setup
function init() {
	clock = new t.Clock(); // Used in render() for controls.update()
	projector = new t.Projector(); // Used in bullet projection
	scene = new t.Scene(); // Holds all objects in the canvas
	scene.fog = new t.FogExp2(0x770011, 0.0020); // color, density
	
	//TOCA A MUSICA! \o\ \o/ /o/
	document.getElementById('music').play();
	document.getElementById('music').loop = true;
	
	// Set up camera
	cam = new t.PerspectiveCamera(60, ASPECT, 1, 10000); // FOV, aspect, near, far
	cam.position.y = UNITSIZE * .2;
	scene.add(cam);
	
	// Camera moves with mouse, flies around with WASD/arrow keys
	controls = new t.FirstPersonControls(cam);
	controls.movementSpeed = MOVESPEED;
	controls.lookSpeed = LOOKSPEED;
	controls.lookVertical = false; // Temporary solution; play on flat surfaces only
	controls.noFly = true;

	// World objects
	setupScene();
	
	// Artificial Intelligence
	setupAI();
	
	// Handle drawing as WebGL (faster than Canvas but less supported)
	renderer = new t.WebGLRenderer();
	renderer.setSize(WIDTH, HEIGHT);
	
	// Add the canvas to the document
	renderer.domElement.style.backgroundColor = '#770011'; // easier to see. Cor do céu!
	document.body.appendChild(renderer.domElement);
	
	// Track mouse position so we know where to shoot
	document.addEventListener( 'mousemove', onDocumentMouseMove, false );
	
	// Shoot on click
	var lastPlayerShot = Date.now(); // Para calcular espera entre tiros
	
	$(document).mousedown(function(e) {
		e.preventDefault;
		if (e.which === 1 && Date.now() > lastPlayerShot + 200) { // Left click only
			lastPlayerShot = Date.now();
			createBullet();
		}
	});
	
	// Display HUD
	$('body').append('<canvas id="radar" width="200" height="200"></canvas>');
	$('body').append('<div id="hud"><p>HEALTH: <span id="health">100</span><br />SCORE: <span id="score">0</span><br /><span id="multiplier">1</span>X</p></div>');
	
	// Set up "hurt" flash
	$('body').append('<div id="hurt"></div>');
	$('#hurt').css({width: WIDTH, height: HEIGHT,});
}

// Helper function for browser frames
function animate() {
	if (runAnim) {
		requestAnimationFrame(animate);
	}
	render();
}

function healthCubeUpdate(){
	// Rotate the health cube
	healthcube.rotation.x += 0.004
	healthcube.rotation.y += 0.008;
	// Allow picking it up once per minute and do not allow when full health
	if (Date.now() > lastHealthPickup + 60000) {
		if (distance(cam.position.x, cam.position.z, healthcube.position.x, healthcube.position.z) < 15 && health != 100) {
			health = Math.min(health + 50, 100);
			$('#health').html(health);
			lastHealthPickup = Date.now();
		}
		healthcube.material.wireframe = false;
	}
	else {
		healthcube.material.wireframe = true;
	}
}

function bulletsUpdate(speed){
	// Update bullets. Walk backwards through the list so we can remove items.
	for (var i = bullets.length-1; i >= 0; i--) {
		var b = bullets[i], p = b.position, d = b.ray.direction;
		if (checkWallCollision(p)) {
			bullets.splice(i, 1);
			scene.remove(b);
			continue;
		}
		// Collide with AI
		var hit = false;
		for (var j = ai.length-1; j >= 0; j--) {
			var a = ai[j];
			var c = a.position;
			var count = 0;
			
			// VERIFICA SE HA COLISAO DE PROJETIL COM CADA VERTICE DE INIMIGO!
			while (count < a.geometry.vertices.length){
				v = a.geometry.vertices[count++];
				
				var x = Math.abs(v.x), z = Math.abs(v.z);
				
				if (p.x < c.x + x && p.x > c.x - x &&
						p.z < c.z + z && p.z > c.z - z &&
						b.owner != a) {
					bullets.splice(i, 1);
					scene.remove(b);
					a.monsterHealth -= PROJECTILEDAMAGE;
					var color = a.material.color, percent = a.monsterHealth / 100;
					a.material.color.setRGB(
							percent * color.r,
							percent * color.g,
							percent * color.b
					);
					hit = true;
					break;
				}
			}
		}
		
		// BULLET ACERTA JOGADOR
		if (distance(p.x, p.z, cam.position.x, cam.position.z) < 25 && b.owner != cam) {		
			$('#hurt').fadeIn(75);
			health -= 10;
			if (health < 0) health = 0;
			val = health < 25 ? '<span style="color: darkRed">' + health + '</span>' : health;
			$('#health').html(val);
			
			multiplier = 1;
			$('#multiplier').html(multiplier);
			bullets.splice(i, 1);
			scene.remove(b);
			$('#hurt').fadeOut(350);
		}
		//ENQUANTO NAO COLIDIU, SE MOVE
		if (!hit) {
			b.translateX(speed * d.x);
			b.translateZ(speed * d.z);
		}
	}
}

function enemiesUpdate(aispeed){
	// Update AI.
	for (var i = ai.length-1; i >= 0; i--) {
		var a = ai[i];
		if (a.monsterHealth <= 0) {
			ai.splice(i, 1);
			scene.remove(a);
			
			// SISTEMA DE PONTOS AO MATAR MONSTRO!
			kills++;
			score += 100 * multiplier;
			multiplier++;
			
			$('#score').html(score);
			$('#multiplier').html(multiplier);
			addAI();
		}
		// Move AI
		var r = Math.random();
		if (r > 0.995) {
			a.lastRandomX = Math.random() * 2 - 1;
			a.lastRandomZ = Math.random() * 2 - 1;
		}
		a.translateX(aispeed * a.lastRandomX);
		a.translateZ(aispeed * a.lastRandomZ);
		var c = getMapSector(a.position);
		if (c.x < 0 || c.x >= mapW || c.y < 0 || c.y >= mapH || checkWallCollision(a.position)) {
			a.translateX(-2 * aispeed * a.lastRandomX);
			a.translateZ(-2 * aispeed * a.lastRandomZ);
			a.lastRandomX = Math.random() * 2 - 1;
			a.lastRandomZ = Math.random() * 2 - 1;
		}
		if (c.x < -1 || c.x > mapW || c.z < -1 || c.z > mapH) {
			ai.splice(i, 1);
			scene.remove(a);
			addAI();
		}

		var cc = getMapSector(cam.position); //Posição relativa ao player
		if (Date.now() > a.lastShot + 1000 && distance(c.x, c.z, cc.x, cc.z) < 2) {
			createBullet(a);
			a.lastShot = Date.now();
		}
	}
}

function playerDeathUpdate(){
	if (health <= 0) {
		runAnim = false;
		$(renderer.domElement).fadeOut();
		$('#radar, #hud').fadeOut();
		$('#intro').fadeIn();
		$('#intro').html('STOP BEING DUMB! PUNCH THE DEMONS!<br>[CLICK TO CONTINUE]');
		$('#intro').one('click', function() {
			location = location;
		});
	}
}

// Update and display
function render() {
	var delta = clock.getDelta(), speed = delta * BULLETMOVESPEED;
	var aispeed = delta * MOVESPEED;
	controls.update(delta); // Move camera
	
	//Chama o update do Cubo de Vida
	healthCubeUpdate();
	
	//Chama o update dos tiros (socos)
	bulletsUpdate(speed);
	
	//Chama o update dos inimigos
	enemiesUpdate(aispeed);
	
	renderer.render(scene, cam); // Repaint
	
	// Chama update de morte do jogador
	playerDeathUpdate();
}

// Set up the objects in the world
function setupScene() {
	var units = mapW;

	// Geometry: floor
	var floor = new t.Mesh(
			new t.CubeGeometry(units * UNITSIZE, 10, units * UNITSIZE),
			new t.MeshLambertMaterial({map: t.ImageUtils.loadTexture('assets/floor-1.jpg')})
	);
	scene.add(floor);
	
	// Geometry: walls
	var cube = new t.CubeGeometry(UNITSIZE, WALLHEIGHT, UNITSIZE);
	var materials = [
	                 new t.MeshLambertMaterial({map: t.ImageUtils.loadTexture('assets/wall-3.jpg')}),
	                 new t.MeshLambertMaterial({map: t.ImageUtils.loadTexture('assets/wall-2.jpg')}),
					 new t.MeshLambertMaterial({map: t.ImageUtils.loadTexture('assets/wall-1.jpg')}),
	                 new t.MeshLambertMaterial({color: 0xFBEBCD}),
	                 ];
	for (var i = 0; i < mapW; i++) {
		for (var j = 0, m = map[i].length; j < m; j++) {
			if (map[i][j]) {
				var wall = new t.Mesh(cube, materials[map[i][j]-1]);
				wall.position.x = (i - units/2) * UNITSIZE;
				wall.position.y = WALLHEIGHT/2;
				wall.position.z = (j - units/2) * UNITSIZE;
				scene.add(wall);
			}
		}
	}
	
	// Health cube
	healthcube = new t.Mesh(
			new t.CubeGeometry(30, 30, 30),
			new t.MeshBasicMaterial({map: t.ImageUtils.loadTexture('assets/health.png')})
	);
	healthcube.position.set(-UNITSIZE-15, 35, -UNITSIZE-15);
	scene.add(healthcube);
	
	// Lighting
	var directionalLight1 = new t.DirectionalLight( 0xF7EFBE, 0.7 );
	directionalLight1.position.set( 0.5, 1, 0.5 );
	scene.add( directionalLight1 );
	
	var directionalLight2 = new t.DirectionalLight( 0xF7EFBE, 0.5 );
	directionalLight2.position.set( -0.5, -1, -0.5 );
	scene.add( directionalLight2 );
}

var ai = [];

function setupAI() {
	for (var i = 0; i < NUMAI; i++) {
		addAI();
	}
}

function sortEnemy(){
	var enemy = getRandBetween(0, 3);
	var path = 'assets/Enemies/';
	var name;

	switch(enemy){
		case 0:
			name = path + 'Demon';
			monsterType = 0;
			break;
		case 1:
			name = path + 'Archvile';
			monsterType = 1;
			break;
		case 2:
			name = path + 'Fatso';
			monsterType = 2;
			break;
		case 3:
			name = path + 'Baron';
			monsterType = 3;
			break;
	}
	
	return name;
}

function addAI() {
	var c = getMapSector(cam.position);
	var monsterNameURL = sortEnemy(); // Sorteia um monstro!	
	
	// Cria o model do monstro
	loader.load(monsterNameURL + '.js', function (geometry) {
		  // Cria o material do monstro.
		  var material = new t.MeshLambertMaterial({
			map: t.ImageUtils.loadTexture(monsterNameURL + '.jpg'),  // carrega a textura do monstro
			
		  });
	  
		  // create a mesh with models geometry and material
		  var o = new t.Mesh(
			geometry,
			material
		  );
			
		do {
			var x = getRandBetween(0, mapW-1);
			var z = getRandBetween(0, mapH-1);
		} while (map[x][z] > 0 || (x == c.x && z == c.z));
		
		x = Math.floor(x - mapW/2) * UNITSIZE;
		z = Math.floor(z - mapW/2) * UNITSIZE;
		o.position.set(x, UNITSIZE * 0.015, z);
		if (monsterType == 0) o.monsterHealth = 100;
		else if (monsterType == 1) o.monsterHealth = 200;
		else if (monsterType == 2) o.monsterHealth = 400;
		else if (monsterType == 3) o.monsterHealth = 500;
		
		o.pathPos = 1;
		o.lastRandomX = Math.random();
		o.lastRandomZ = Math.random();
		o.lastShot = Date.now(); // Higher-fidelity timers aren't a big deal here.
		ai.push(o);
		scene.add(o);
	});
}

function getAIpath(a) {
	var p = getMapSector(a.position);
	do { // Cop-out
		do {
			var x = getRandBetween(0, mapW-1);
			var z = getRandBetween(0, mapH-1);
		} while (map[x][z] > 0 || distance(p.x, p.z, x, z) < 3);
		var path = findAIpath(p.x, p.z, x, z);
	} while (path.length == 0);
	return path;
}

/**
 * Find a path from one grid cell to another.
 *
 * @param sX
 *   Starting grid x-coordinate.
 * @param sZ
 *   Starting grid z-coordinate.
 * @param eX
 *   Ending grid x-coordinate.
 * @param eZ
 *   Ending grid z-coordinate.
 * @returns
 *   An array of coordinates including the start and end positions representing
 *   the path from the starting cell to the ending cell.
 */
function findAIpath(sX, sZ, eX, eZ) {
	var backupGrid = grid.clone();
	var path = finder.findPath(sX, sZ, eX, eZ, grid);
	grid = backupGrid;
	return path;
}

function distance(x1, y1, x2, y2) {
	return Math.sqrt((x2-x1)*(x2-x1)+(y2-y1)*(y2-y1));
}

function getMapSector(v) {
	var x = Math.floor((v.x + UNITSIZE / 2) / UNITSIZE + mapW/2);
	var z = Math.floor((v.z + UNITSIZE / 2) / UNITSIZE + mapW/2);
	return {x: x, z: z};
}

/**
 * Check whether a Vector3 overlaps with a wall.
 *
 * @param v
 *   A THREE.Vector3 object representing a point in space.
 *   Passing cam.position is especially useful.
 * @returns {Boolean}
 *   true if the vector is inside a wall; false otherwise.
 */
function checkWallCollision(v) {
	var c = getMapSector(v);
	return map[c.x][c.z] > 0;
}

// Radar
function drawRadar() {
	var c = getMapSector(cam.position), context = document.getElementById('radar').getContext('2d');
	context.font = '10px Helvetica';
	for (var i = 0; i < mapW; i++) {
		for (var j = 0, m = map[i].length; j < m; j++) {
			var d = 0;
			for (var k = 0, n = ai.length; k < n; k++) {
				var e = getMapSector(ai[k].position);
				if (i == e.x && j == e.z) {
					d++;
				}
			}
			if (i == c.x && j == c.z && d == 0) {
				context.fillStyle = '#0000FF';
				context.fillRect(i * 20, j * 20, (i+1)*20, (j+1)*20);
			}
			else if (i == c.x && j == c.z) {
				context.fillStyle = '#AA33FF';
				context.fillRect(i * 20, j * 20, (i+1)*20, (j+1)*20);
				context.fillStyle = '#000000';
				context.fillText(''+d, i*20+8, j*20+12);
			}
			else if (d > 0 && d < 10) {
				context.fillStyle = '#FF0000';
				context.fillRect(i * 20, j * 20, (i+1)*20, (j+1)*20);
				context.fillStyle = '#000000';
				context.fillText(''+d, i*20+8, j*20+12);
			}
			else if (map[i][j] > 0) {
				context.fillStyle = '#666666';
				context.fillRect(i * 20, j * 20, (i+1)*20, (j+1)*20);
			}
			else {
				context.fillStyle = '#CCCCCC';
				context.fillRect(i * 20, j * 20, (i+1)*20, (j+1)*20);
			}
		}
	}
}

var bullets = [];
var sphereMaterial = new t.MeshLambertMaterial({color: 0x333333});
var punchMaterial = new t.MeshBasicMaterial({map: t.ImageUtils.loadTexture('assets/hand2.jpg')})
function createBullet(obj) {
	
	//Se createBullet foi chamado sem referencia à um objeto, criador é o player.
	// Se o criador é o player, o tiro começa na altura da camera E GIGANTE. Se inimigo, começa bem mais acima (culpa do model!)
	
	if (obj === undefined) {
		var sphereGeo = new t.CubeGeometry(24, 32, 32);
		var sphere = new t.Mesh(sphereGeo, punchMaterial);
		obj = cam;
		sphere.position.set(obj.position.x, obj.position.y * 0.7, obj.position.z);
	}else{
		var sphereGeo = new t.SphereGeometry(4, 6, 6);
		var sphere = new t.Mesh(sphereGeo, sphereMaterial);
		sphere.position.set(obj.position.x, obj.position.y * 10.0, obj.position.z);
	}

	if (obj instanceof t.Camera) {
		var vector = new t.Vector3(mouse.x, mouse.y, -1);
		projector.unprojectVector(vector, obj);
		sphere.ray = new t.Ray(
				obj.position,
				vector.subSelf(obj.position).normalize()
		);
	}
	else {
		var vector = cam.position.clone();
		sphere.ray = new t.Ray(
				obj.position,
				vector.subSelf(obj.position).normalize()
		);
	}
	sphere.owner = obj;
	
	bullets.push(sphere);
	scene.add(sphere);
	
	return sphere;
}


function onDocumentMouseMove(e) {
	e.preventDefault();
	mouse.x = (e.clientX / WIDTH) * 2 - 1;
	mouse.y = - (e.clientY / HEIGHT) * 2 + 1;
}

// Handle window resizing
$(window).resize(function() {
	WIDTH = window.innerWidth;
	HEIGHT = window.innerHeight;
	ASPECT = WIDTH / HEIGHT;
	if (cam) {
		cam.aspect = ASPECT;
		cam.updateProjectionMatrix();
	}
	if (renderer) {
		renderer.setSize(WIDTH, HEIGHT);
	}
	$('#intro, #hurt').css({width: WIDTH, height: HEIGHT,});
});

// Stop moving around when the window is unfocused (keeps my sanity!)
$(window).focus(function() {
	if (controls) controls.freeze = false;
});
$(window).blur(function() {
	if (controls) controls.freeze = true;
});

//Get a random integer between lo and hi, inclusive.
//Assumes lo and hi are integers and lo is lower than hi.
function getRandBetween(lo, hi) {
 return parseInt(Math.floor(Math.random()*(hi-lo+1))+lo, 10);
}



