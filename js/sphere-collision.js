/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global brackets: true, $, window, navigator , clearInterval , setInterval, d3, THREE, Stats , requestAnimationFrame*/

"use strict";

function sphereCollision(canvas, _panelFeedBack) {
    _panelFeedBack.opened = false;

    var movementSpeed = 50;
    var totalObjects = 1000;
    var objectSize = 10;
    var sizeRandomness = 4000;
    var colors = [0xFF0FFF, 0xCCFF00, 0xFF000F, 0x996600, 0xFFFFFF];
    var dirs = [];
    var parts = [];
    ///////////////////////////////// for blow

    //sound
    // create an AudioListener and add it to the camera
    var listener = new THREE.AudioListener();


// create a global audio source
    var snapSound = new THREE.Audio( listener );

// load a sound and set it as the Audio object's buffer
    var audioLoader = new THREE.AudioLoader();



    let sbVertexShader = [
        "varying vec3 vWorldPosition;",
        "void main() {",
        "  vec4 worldPosition = modelMatrix * vec4( position, 1.0 );",
        "  vWorldPosition = worldPosition.xyz;",
        "  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",
        "}",
    ].join("\n");
    let sbFragmentShader = [
        "uniform vec3 topColor;",
        "uniform vec3 bottomColor;",
        "uniform float offset;",
        "uniform float exponent;",
        "varying vec3 vWorldPosition;",
        "void main() {",
        "  float h = normalize( vWorldPosition + offset ).y;",
        "  gl_FragColor = vec4( mix( bottomColor, topColor, max( pow( h, exponent ), 0.0 ) ), 1.0 );",
        "}",
    ].join("\n");

    var stats;
    var camera, scene, renderer;

    var mouse = new THREE.Vector2(),
        controls, force;
    var nodes, spheresNodes = [],
        root, raycaster = new THREE.Raycaster(),
        INTERSECTED;

    function rnd(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function ExplodeAnimation(x,y)
    {
        var geometry = new THREE.Geometry();

        for (let i = 0; i < totalObjects; i ++)
        {
            var vertex = new THREE.Vector3();
            vertex.x = x;
            vertex.y = y;
            vertex.z = 0;

            geometry.vertices.push( vertex );
            dirs.push({x:(Math.random() * movementSpeed)-(movementSpeed/2),y:(Math.random() * movementSpeed)-(movementSpeed/2),z:(Math.random() * movementSpeed)-(movementSpeed/2)});
        }
        var material = new THREE.ParticleBasicMaterial( { size: objectSize,  color: colors[Math.round(Math.random() * colors.length)] });
        var particles = new THREE.ParticleSystem( geometry, material );

        this.object = particles;
        this.status = true;

        this.xDir = (Math.random() * movementSpeed)-(movementSpeed/2);
        this.yDir = (Math.random() * movementSpeed)-(movementSpeed/2);
        this.zDir = (Math.random() * movementSpeed)-(movementSpeed/2);

        scene.add( this.object  );

        this.update = function(){
            if (this.status === true){
                var pCount = totalObjects;
                while(pCount--) {
                    var particle =  this.object.geometry.vertices[pCount];
                    particle.y += dirs[pCount].y;
                    particle.x += dirs[pCount].x;
                    particle.z += dirs[pCount].z;
                }
                this.object.geometry.verticesNeedUpdate = true;
            }
        }

    }

    //Expansion of collision function from http://bl.ocks.org/mbostock/3231298
    function collide(node) {
        var r = node.radius,
            nx1 = node.x - r,
            nx2 = node.x + r,
            ny1 = node.y - r,
            ny2 = node.y + r,
            nz1 = node.z - r,
            nz2 = node.z + r;
        return function (quad, x1, y1, z1, x2, y2, z2) {

            if (quad.point && (quad.point !== node)) {
                var x = node.x - quad.point.x,
                    y = node.y - quad.point.y,
                    z = node.z - quad.point.z,
                    l = Math.sqrt(x * x + y * y + z * z),
                    r = node.radius + quad.point.radius;

                if (l < r) {

                    l = (l - r) / l * 0.5;
                    node.x -= x *= l;
                    node.y -= y *= l;
                    node.z -= z *= l;

                    quad.point.x += x;
                    quad.point.y += y;
                    quad.point.z += z;
                }
            }
            return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1 || z1 > nz2 || z2 < nz1;
        };
    }

    function addSkybox() {
        var iSBrsize = 5000;
        var uniforms = {
            topColor: {type: "c", value: new THREE.Color(0x0077ff)}, bottomColor: {type: "c", value: new THREE.Color(0xffffff)},
            offset: {type: "f", value: iSBrsize}, exponent: {type: "f", value: 1.5}
        }
        var skyGeo = new THREE.SphereGeometry(iSBrsize, 500, 500);
        let skyMat = new THREE.ShaderMaterial({
            vertexShader: sbVertexShader, fragmentShader: sbFragmentShader,
            uniforms: uniforms, side: THREE.DoubleSide, fog: false
        });
        let skyMesh = new THREE.Mesh(skyGeo, skyMat);
        skyMesh.name = "THESKY";
        scene.add(skyMesh);
    }

    function getSpherePackPositions(canvas) {
        console.log(":::: getSpherePackPositions nodes :::::");

        var containerEle = $(canvas);
        var SCREEN_WIDTH = containerEle.innerWidth();
        var SCREEN_HEIGHT = containerEle.innerHeight();


        //create nodes (balloons)
        nodes = d3.range(300).map(function () {
            return {
                radius: rnd(50, 100)
            };
        });
        // nodes[0].py= 300;
        root = nodes[0];
        root.radius = 150;
        root.fixed = false;

        force = d3.layout.force3D()
            .gravity(-0.00001)
            // .charge(function (d, i) {
            //     return i ? 0 : 5000;
            // })
            .nodes(nodes)
            .size([SCREEN_WIDTH/2, SCREEN_HEIGHT/2, 1]);

        force.start();

        console.log(nodes);

        return nodes;
    }

    function addSpheres() {
        var nodes = getSpherePackPositions(canvas);

        for (var i = 0; i < nodes.length; i++) {
            var geo = new THREE.SphereGeometry(nodes[i].radius, 20, 20);
            var sphere = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
                color: Math.random() * 0xffffff
            }));
            var vec = new THREE.Vector3(nodes[i].x, nodes[i].y, nodes[i].z);
            // var vec = new THREE.Vector3(0, -100, 0);
            sphere.position.add(vec);
            spheresNodes.push(sphere);
            scene.add(sphere);
        }

    }

    function setupScreen(canvas) {
        var containerEle = $(canvas);

        //set camera
        camera = new THREE.PerspectiveCamera(45, containerEle.innerWidth() / containerEle.innerHeight(), 500, 10000);
        camera.position.set(0, 800, 2000);
        camera.lookAt(0,100,0);

        //for snap sound
        camera.add( listener );
        audioLoader.load( './js/snap.mp3', function( buffer ) {
            snapSound.setBuffer( buffer );
            // snapSound.setLoop( true );
            snapSound.setVolume( 0.6 );
            // snapSound.play();
        });

        // RENDERER
        renderer = new THREE.WebGLRenderer({
            antialias: true
        });
        renderer.setClearColor( 0xffffff );

        renderer.setSize(containerEle.innerWidth(), containerEle.innerHeight());
        renderer.domElement.style.position = 'absolute';
        containerEle.append(renderer.domElement);

        // controls = new THREE.OrbitControls(camera, renderer.domElement);

        //scene
        scene = new THREE.Scene();
        // scene.fog = new THREE.Fog(0xffffff, 1000, 10000);
        // LIGHTS

        addSkybox();

        var directionalLight = new THREE.DirectionalLight("#bfbfbf", 0.5);
        directionalLight.position.set(100, 100, -100);
        scene.add(directionalLight);

        var hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 1.25);
        hemiLight.color.setHSL(0.6, 1, 0.75);
        hemiLight.groundColor.setHSL(0.1, 0.8, 0.7);
        hemiLight.position.y = 5100;
        scene.add(hemiLight);

        // var axes = new THREE.AxisHelper(1000);
        // scene.add(axes);

        // stats = new Stats();
        // stats.domElement.style.position = 'absolute';
        // stats.domElement.style.top = '0px';
        // containerEle.append(stats.domElement);

        window.addEventListener('resize', onWindowResize, false);
        document.addEventListener('click', onMouseClick, false);

        document.addEventListener('mousemove', onDocumentMouseMove, false);



        addSpheres();
        function onMouseClick(event) {
            event.preventDefault();

            if (_panelFeedBack.opened)
                return;

            console.log( "onMouseClick!!" );

            raycaster.setFromCamera(mouse, camera);

            let intersections = raycaster.intersectObjects(scene.children, true);
            if (intersections.length > 0){
                if (intersections[0].object.name !== "THESKY"){
                    console.log("intersection detected!!");
                    console.log(intersections);
                    scene.remove( intersections[0].object );
                    console.log(intersections[0].object.position.x, intersections[0].object.position.y);
                    parts.push(new ExplodeAnimation(intersections[0].object.position.x, intersections[0].object.position.y));
                    snapSound.play();

                    //open panel feedback
                    _panelFeedBack.opened = true;
                    let timeLine = new TimelineMax();
                    timeLine.to(
                            _panelFeedBack,
                            0,
                            {"z-index": 10},
                        )
                        .fromTo(
                        _panelFeedBack,
                        2,
                        { opacity: 0 },
                        { opacity: 1 , ease: Power1.easeOut},
                        "0"
                    );

                }
            }
        }

        function onWindowResize() {
            camera.aspect = containerEle.innerWidth() / containerEle.innerHeight();
            camera.updateProjectionMatrix();
            renderer.setSize(containerEle.innerWidth(), containerEle.innerHeight());

        }

        function onDocumentMouseMove(event) {
            event.preventDefault();
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        }

    }

    function updateSpheres() {
        var q = d3.geom.octree(nodes);
        for (var i = 0; i < nodes.length; ++i) {
            q.visit(collide(nodes[i]));
            spheresNodes[i].position.x = nodes[i].x;
            spheresNodes[i].position.y = nodes[i].y;
            spheresNodes[i].position.z = nodes[i].z;
        }

    }

    function moveSpheres() {
        for (var i = 0; i < nodes.length; ++i) {

            nodes[i].y += .05;
            // nodes[i].x += .1;
            // spheresNodes[i].position.y += 1;
            // spheresNodes[i].position.z = nodes[i].z;
        }

    }

    function animate() {
        requestAnimationFrame(animate);
        render();
        // stats.update();
    }

    function render() {
        // nodes[0].py += 1;


        updateSpheres();
        moveSpheres();
        force.resume();
        // console.log(spheresNodes[0].position.y)

        raycaster.setFromCamera(mouse, camera);
        var intersects = raycaster.intersectObjects(spheresNodes);
       /* if (intersects.length > 0) {
            INTERSECTED = intersects[0].object;
            root.px = INTERSECTED.position.x;
            root.py = INTERSECTED.position.y;
            root.pz = INTERSECTED.position.z;
            force.resume();
        }*/

        if (intersects.length > 0) {
            if (INTERSECTED !== intersects[0].object) {

                if (INTERSECTED) {
                    // console.log(INTERSECTED);
                    INTERSECTED.material.emissive.setHex(INTERSECTED.currentHex);
                }

                INTERSECTED = intersects[0].object;
                // INTERSECTED.currentHex = INTERSECTED.material.emissive.getHex();
                INTERSECTED.material.emissive.setHex(0xff0000);
            }
        } else {
            if (INTERSECTED)
                INTERSECTED.material.emissive.setHex(INTERSECTED.currentHex);
            INTERSECTED = null;
        }



        var pCount = parts.length;
        while(pCount--) {
            parts[pCount].update();
        }


        scene.rotation.y += 0.001;

        renderer.render(scene, camera);





    }




    setupScreen(canvas);
    animate();
}


$(function () {
    let panelFeedBack = $('#panelFeedback');
    let btnFrases = $('.btnFrases');

    btnFrases.click(function(){
        let timeLine = new TimelineMax();

        timeLine.fromTo(
            panelFeedBack,
            .3,
            { opacity: 1 },
            {
                opacity: 0
            },
            "0"
        ).to(
            panelFeedBack,
            0,
            {"z-index": -10,
                onComplete: ()=>{
                    panelFeedBack.opened = false;
                }
            },
        );

    });

    sphereCollision($('#stage'), panelFeedBack);
});
