import {
    AmbientLight,
    AxesHelper,
    DirectionalLight,
    GridHelper,
    PerspectiveCamera,
    Scene,
    WebGLRenderer,
    Raycaster,
    Vector2,
    MeshLambertMaterial
  } from "three";
  import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
  import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from "three-mesh-bvh";
  import {IFCLoader} from "web-ifc-three";
  import {IFCBUILDING} from 'web-ifc';
  //Creates the Three.js scene
  const scene = new Scene();
  
  //Object to store the size of the viewport
  const size = {
    width: window.innerWidth,
    height: window.innerHeight,
  };
  
  //Creates the camera (point of view of the user)
  const camera = new PerspectiveCamera(70, size.width / size.height);
  camera.position.z = 15;
  camera.position.y = 13;
  camera.position.x = 8;
  
  //Creates the lights of the scene
  const lightColor = 0xffffff;
  
  const ambientLight = new AmbientLight(lightColor, 0.5);
  scene.add(ambientLight);
  
  const directionalLight = new DirectionalLight(lightColor, 2);
  directionalLight.position.set(5, 10, 5);
  scene.add(directionalLight);
  
  //Sets up the renderer, fetching the canvas of the HTML
  const threeCanvas = document.getElementById("three-canvas");
  const renderer = new WebGLRenderer({ canvas: threeCanvas, alpha: true });
  renderer.setSize(size.width, size.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  
  //Creates grids and axes in the scene
  const grid = new GridHelper(50, 30);
  scene.add(grid);
  
  const axes = new AxesHelper();
  axes.material.depthTest = false;
  axes.renderOrder = 1;
  scene.add(axes);
  
  //Creates the orbit controls (to navigate the scene)
  const controls = new OrbitControls(camera, threeCanvas);
  controls.enableDamping = true;
  controls.target.set(-2, 0, 0);
  
  //Animation loop
  const animate = () => {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };
  
  animate();
  
  //Adjust the viewport to the size of the browser
  window.addEventListener("resize", () => {
    (size.width = window.innerWidth), (size.height = window.innerHeight);
    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();
    renderer.setSize(size.width, size.height);
  });

const input = document.getElementById("file-input");
const ifcLoader = new IFCLoader();


ifcLoader.ifcManager.setupThreeMeshBVH(computeBoundsTree, disposeBoundsTree, acceleratedRaycast);

const ifcModels = [];

input.addEventListener(
  "change",
  async (changed) => {
      const ifcURL = URL.createObjectURL(changed.target.files[0]);
      const model = await ifcLoader.loadAsync(ifcURL);
      scene.add(model);
      ifcModels.push(model);
  },
  false
);

const raycaster = new Raycaster();
raycaster.firstHitOnly = true;
const mouse = new Vector2();

function cast(event){
  // Computes the position of the mouse on the screen
  const bounds = threeCanvas.getBoundingClientRect();

  const x1 = event.clientX - bounds.left;
  const x2 = bounds.right - bounds.left;
  mouse.x = (x1 / x2) * 2 - 1;

  const y1 = event.clientY - bounds.top;
  const y2 = bounds.bottom - bounds.top;
  mouse.y = -(y1 / y2) * 2 + 1;

  // Places it on the camera pointing to the mouse
  raycaster.setFromCamera(mouse, camera);

  // Casts a ray
  return raycaster.intersectObjects(ifcModels)[0];

}

const highlightMaterial = new MeshLambertMaterial({
  transparent: true,
  opacity: 0.6,
  color: 0xff88ff,
  depthTest: false
});

const selectionMaterial = new MeshLambertMaterial({
  transparent: true,
  opacity: 0.8,
  color: 'pink',
  depthTest: false
});

const selectionClickMaterial = new MeshLambertMaterial({
  transparent: true,
  opacity: 0.7,
  color: 'blue',
  depthTest: false
});

let lastModel;

async function pick(event, material, getProps, getIFCprops){
  const found = cast(event);

  if (found){
    const index = found.faceIndex;
    lastModel = found.object;
    const geometry = found.object.geometry;
    const id = ifcLoader.ifcManager.getExpressId(geometry, index);

    console.log(id);

    if (getProps){
      const props = await ifcLoader.ifcManager.getItemProperties(found.object.modelID, id);
      console.log(props);
      const psets = await ifcLoader.ifcManager.getPropertySets(found.object.modelID, id);

      const realValues = [];
      for(const pset of psets){
        for (const prop of pset.HasProperties){
          const id = prop.value;
          const value = await ifcLoader.ifcManager.getItemProperties(found.object.modelID, id); 
          realValues.push(value);
        }

        pset.HasProperties = realValues;
      }
      console.log(psets);
    }

    if(getIFCprops) {
      const buildingsIDs = await ifcLoader.ifcManager.getAllItemsOfType(found.object.modelID, IFCBUILDING);
      const buildingID = buildingsIDs[0];

      const buildingProps = await ifcLoader.ifcManager.getItemProperties(found.object.modelID, buildingID);

      console.log(buildingProps);
    } 

    ifcLoader.ifcManager.createSubset({
      modelID: found.object.modelID,
      material: material,
      ids: [id],
      scene,
      removePrevious: true
    });
  }
  else if(lastModel){
    ifcLoader.ifcManager.removeSubset(lastModel.modelID, highlightMaterial);
    lastModel = undefined;
  }
}


threeCanvas.onmousemove = (event) => pick(event, selectionMaterial, false, false);
threeCanvas.ondblclick = (event) => pick(event, highlightMaterial, true, false);
threeCanvas.onclick = (event) => pick(event, selectionClickMaterial, false, true);



