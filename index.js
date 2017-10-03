const INFINITE = 999999999;

class PathFinder {
	
	constructor() {
		this.optimalPathInfo = {
			path : [],
			dist : INFINITE
		};
		this.currentPath = [];
	}
	
	getShortest(current, visited) {
		this.currentPath.push(current);
		
		if (visited == this.allVisited){
			let sum = 0;
			for (let i = 0; i < this.currentPath.length ; i++) {
				if (i + 1 < this.currentPath.length) {
					sum += this.dist[this.currentPath[i]][this.currentPath[i+1]];
				}
			}
			if (sum < this.optimalPathInfo.dist) {
				this.optimalPathInfo.dist = sum;
				this.optimalPathInfo.path = [...this.currentPath];
			}
			return 0;
		}

		if (this.cache[current][visited] >= 0){
			return this.cache[current][visited];
		}
		let cost = INFINITE;

		for (let i = 0; i < this.numVertices; i++) {
			let next = this.vertices[i];
			
			if ((visited & (1 << next)) != 0) 
				continue;
			
			if(this.dist[current][next] == 0) 
				continue;

			cost = Math.min(cost, this.dist[current][next] + this.getShortest(next, visited + (1 << next)));
			this.currentPath.pop();
		}

		this.cache[current][visited] = cost;
		return cost;
	}
	
	initialize(vertices, buildings) {
		this.dist = {};
		this.cache = {};
		this.vertices = vertices;
		this.numVertices = vertices.length;
		this.allVisited = 0;

		for (let i = 0; i < this.numVertices; i++) {
			this.dist[vertices[i]] = {};
			this.cache[vertices[i]] = {};
			this.allVisited = this.allVisited | 1 << vertices[i];
			for (let j = 0; j < this.numVertices; j++) {
				this.dist[vertices[i]][vertices[j]] = getDistance(buildings[vertices[i]].x, buildings[vertices[i]].y, buildings[vertices[j]].x, buildings[vertices[j]].y);
			}
		}
	}
	
	find(startPos) {
		this.getShortest(startPos, 1 << startPos);	  
		return this.optimalPathInfo;
	}
	
}   
		
function getDistance(sourceX, sourceY, targetX, targetY) {
	return Math.abs(sourceX-targetX)+Math.abs(sourceY-targetY);
}

function getUnionOfDestinations(indexOfCurrentBuilding, destination, peoples, vehicle) {
	const buildingNameToIndex = {
	   'A' : 0, 'B' : 1, 'C' : 2, 'D' : 3, 'E' : 4, 'F' : 5, 'G' : 6
	};
	const routeSet = new Set();

	routeSet.add(indexOfCurrentBuilding);
	routeSet.add(buildingNameToIndex[destination]);

	vehicle.picks.forEach(name => {
		routeSet.add(buildingNameToIndex[getPersonByName(name, peoples).destination]);
	});
	vehicle.peoples.forEach(v => {
		routeSet.add(buildingNameToIndex[v.destination]);
	});

	return Array.from(routeSet);
}

function waitForPeople(v, peoples, buildings, indexOfCurrentBuilding) {

	const optimalPathInfo = {
		dist : INFINITE,
		numPassengers : 1,
		path : []
	};
	let minDist = INFINITE;
	let dist = 0;
	let peopleClone = JSON.parse(JSON.stringify(peoples)).filter(person => person.x === v.x && person.y === v.y && !person.onBoarding);
	
	peopleClone = peopleClone.sort((a, b) => {
		const distA = getDistance(buildings[indexOfCurrentBuilding].x, buildings[indexOfCurrentBuilding].y, getBuilding(a.destination,buildings).x, getBuilding(a.destination,buildings).y);
		const distB = getDistance(buildings[indexOfCurrentBuilding].x, buildings[indexOfCurrentBuilding].y, getBuilding(b.destination,buildings).x, getBuilding(b.destination,buildings).y);
		return distA > distB;
	}).forEach(personClone => {
		if ((v.picks.length + v.peoples.length) >= 4) {
			return;
		}
		const pathFinder = new PathFinder();
		pathFinder.initialize(getUnionOfDestinations(indexOfCurrentBuilding, personClone.destination, peoples, v), buildings);
		const pathFound = pathFinder.find(indexOfCurrentBuilding);

		let boarding = false;
		/**
		 * if getting one more customer is more profitable than leaving now,
		 */
		if ((optimalPathInfo.dist / optimalPathInfo.numPassengers) > (pathFound.dist / (v.peoples.length + v.picks.length + 1))) {
			if ((v.peoples.length + v.picks.length) > 0 && v.route && v.route.length > 0) {

				const candidates = [...v.peoples, ...v.picks.map(name => getPersonByName(name, peoples)), personClone];

				if (candidates.some(v => {
					return v.time < getDistanceWithRoute(pathFound.path.map(i => buildings[i].name), buildings[indexOfCurrentBuilding].name, v.destination, buildings);
				})) {
					return;
				}
			}

			optimalPathInfo.dist = pathFound.dist;
			optimalPathInfo.path = [...pathFound.path].map(i => buildings[i].name);
			optimalPathInfo.numPassengers = v.peoples.length + v.picks.length + 1;
			boarding = true;
		}

		/** 
		 * update vehicle's route
		 */
		if(boarding) {
			getPersonByName(personClone.name, peoples).onBoarding = true;
			v.route = optimalPathInfo.path;
			v.routeDist = optimalPathInfo.dist;
			v.pick(personClone.name);
		}
	});

	if (v.route[0] === buildings[indexOfCurrentBuilding].name){
		v.route.shift();
	}
}

function getBuilding(name, buildings) {
   var building;
   buildings.forEach(v => {
		if (v.name === name) {
			building = v;
		}
   });
   return building;
}

function getPersonByName(name, peoples) {
	for(let person of peoples) {
		if (person.name == name) {
			return person;
		}
	}
}

function getDistanceWithRoute(route, s, d, buildings) {
	if (s === d) {
		return 0;
	}
	let started = false;
	let sum = 0;
	
	for (let i = 0 ; i < route.length ; i++) {
		if (route[i] === s) {
			started = true;
			continue;
		}
		if (started) {
			const source = getBuilding(route[i-1], buildings);
			const dest = getBuilding(route[i], buildings);
			sum += getDistance(source.x, source.y, dest.x, dest.y);
		}
		if (route[i] === d) {
			break;
		}
	}
	return sum;
}

function onBuilding(v, buildings) {
	let pos = -1;
	buildings.some((b, i) => {
		if (v.x === b.x && v.y === b.y)
			pos = i;
	});
	return pos;
}

function getRandomeBuilding(arr) {
	for (let i = arr.length; i; i--) {
		let j = Math.floor(Math.random() * i);
		[arr[i - 1], arr[j]] = [arr[j], arr[i - 1]];
	}

	return arr[0];
}

function moveToStartingPoint(v, name, buildings) {
	if (!v.route || v.route.length === 0) {
		if(!v.route)
			v.route = [];
		v.route.push(name);
	}
	
	v.moveTo(getBuilding(v.route[0], buildings));
}

function turn(vehicles,peoples,buildings){
	vehicles.forEach(v => {
		const currentIndexOfBuilding = onBuilding(v, buildings);
		if (currentIndexOfBuilding !== -1) {
			if(v.route && v.route.length > 0) {
				const firstRoute = v.route[0];
				if (firstRoute === buildings[currentIndexOfBuilding].name){
					v.route.shift();
				}
			}
			if ((v.picks.length + v.peoples.length) < 4)  {
				waitForPeople(v, peoples, buildings, currentIndexOfBuilding);
			}
		}
		if (v.peoples.length > 0 && v.picks.length === 0){
			v.moveTo(getBuilding(v.route[0],buildings));
		}
		else if (currentIndexOfBuilding === -1) {
			moveToStartingPoint(v, getRandomeBuilding(buildings.map(v => v.name)), buildings);
		}
	});
}
