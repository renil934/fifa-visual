//data url
var lifeExpectancyFile = "gpd_test2.csv",
    populationFile = "pop_test2.csv",
    gdpFile = "exp_test2.csv",
    regionFile = "color_regions.csv";

var gdp, pop, life, group;

//selected time range
var startYear = 1872,
    endYear = 2018,
    span = endYear - startYear + 1;

//filter out nations with too few records
var validLimit = 20;

//colors of regions
var colors = {
    "America": "yellow",
    "East Asia & Pacific": "red",
    "Europe & Central Asia": "orange",
    "Middle East & North Africa": "lightgreen",
    "South Asia": "skyblue",
    "Sub-Saharan Africa": "blue"
};

//visual sizes
var svg = d3.select("svg"),
    width = +svg.attr("width"),
    height = +svg.attr("height"),
    margin = {
        "left": 40,
        "top": 20
    },
    innerWidth = width - margin.left * 2,
    innerHeight = height - margin.top * 2,
    largestRadius = 30;

//scales
var scaleX = d3.scaleLinear()
    .range([0, innerWidth]);
var scaleY = d3.scaleLinear()
    .range([innerHeight, 0]);
var scaleR = d3.scaleSqrt()
    .range([-50, largestRadius]);

//axes
var axisX = d3.axisBottom()
    .ticks(10, d3.format(","));
var axisY = d3.axisLeft()
    .ticks(10);

var drag = d3.drag()
    .on("start", dragStarted)
    .on("drag", dragging)
    .on("end", dragEnded);

var gRoot = svg.append("g")
    .attr("transform", "translate(" + [margin.left, margin.top] + ")");

//x label
gRoot.append("text")
    .attr("class", "x label")
    .attr("text-anchor", "end")
    .attr("x", innerWidth)
    .attr("y", innerHeight - 5)
    .text("income per capita, inflation-adjusted (dollars)");

//y label
gRoot.append("text")
    .attr("class", "y label")
    .attr("text-anchor", "end")
    .attr("x", 5)
    .attr("y", 10)
    .attr("transform", "rotate(-90)")
    .text("life expectancy (years)");

//nation label
var nationLabel = gRoot.append("text")
    .attr("class", "nation label")
    .attr("text-anchor", "start")
    .attr("x", 20)
    .attr("y", 80);

//year label
var scaleYear = d3.scaleLinear()
    .domain([0, 450])
    .range([0, span - 1]);
var gYearLabel = gRoot.append("g")
    .attr("transform", "translate(" + [500, 280] + ")");
var yearLabel = gYearLabel.append("text")
    .attr("class", "year label")
    .attr("y", 150)
    .text(startYear);

//svg groups (for transformation and "layering")
var gTrail = gRoot.append("g");
var gTrailSelected = gRoot.append("g");
var gAxisX = gRoot.append("g")
    .attr("transform", "translate(" + [0, innerHeight] + ")");
var gAxisY = gRoot.append("g");
var gDots = gRoot.append("g")
    .attr("class", "dots");

var mouseIsDown = false;
gYearLabel.append("rect")
    .attr("y", 25)
    .attr("width", 450)
    .attr("height", 100)
    .style("fill", "transparent")
    .on("mousemove", function () {
        if (!mouseIsDown) {
            update(Math.floor(scaleYear(d3.event.x - 548)));
        }
    });

var circles;

var nations,
    map;

d3.csv(gdpFile).then(function (gdpData) {
    d3.csv( populationFile).then(function (popData) {
        d3.csv(lifeExpectancyFile).then(function (lifeData) {
            d3.csv(regionFile).then(function (groupData) {
                gdp = gdpData;
                pop = popData;
                life = lifeData;
                group = groupData;
                start();
            });
        });
    });
});

function start() {
    //preprocess data
    //to map
    map = buildMap();
    //to array
    nations = [];
    for (var name in map) {
        nations.push(map[name]);
    }
    //order: nations of large population painted beneath
    nations.sort(function (a, b) {
        return b.pop[span - 1] - a.pop[span - 1];
    });

    scaleX.domain([getMin("gdp")-1, getMax("gdp")]);
    scaleY.domain([getMin("life"), getMax("life")+1]);
    scaleR.domain([getMin("pop"), getMax("pop")]);

    //calculate positions
    nations.forEach(nation => {
        nation.points = [];
        for (var i = 0; i < span; i++) {
            nation.points.push([scaleX(nation.gdp[i]), scaleY(nation.life[i])]);
        }
    });

    //produce image
    gAxisX.call(axisX.scale(scaleX));
    gAxisY.call(axisY.scale(scaleY));

    circles = gDots.selectAll("circle")
        .data(nations)
        .enter().append("circle")
        .attr("fill", d => colors[d.group])
        .on("mouseenter", mouseentered)
        .on("mouseleave", mouseleaved);

    update(0);

    circles.call(drag);
}

function buildMap() {
    var map = {};
    addAttr(map, gdp, "", "gdp", true);
    addAttr(map, life, "Life expectancy at brith", "life", false);
    addAttr(map, pop, "Population", "pop", false);
    group.forEach(function (ob) {
        var name = ob["Entity"];
        if (map[name]) {
            map[name]["group"] = ob["Group"];
            map[name]["name"] = name;
        }
    });
    for (var name_1 in map) {
        var nation = map[name_1],
            gdp_1 = nation["gdp"],
            life_1 = nation["life"],
            pop_1 = nation["pop"],
            group_1 = nation["group"];
        if (!gdp_1 || !life_1 || !pop_1 || !group_1) { //delete nations with incomplete data
            delete map[name_1];
            continue;
        }
        //interpolate
        var interpolatorGdp = new Interpolator(gdp_1);
        var interpolatorLife = new Interpolator(life_1);
        var interpolatorPop = new Interpolator(pop_1);
        var i;
        for (i = 0; i < span; i++) {
            if (isNaN(gdp_1[i])) {
                gdp_1[i] = interpolatorGdp.interpolate(i);
            }
            if (isNaN(life_1[i])) {
                life_1[i] = interpolatorLife.interpolate(i);
            }
            if (isNaN(pop_1[i])) {
                pop_1[i] = interpolatorPop.interpolate(i);
            }
        }
    }
    return map;
}

function addAttr(map, attr, getName, setName, isNew) {
    attr.forEach(function (ob) {
        var name = ob[getName];
        if (map[name] == undefined) {
            if (isNew) {
                map[name] = {};
            } else {
                return;
            }
        }
        delete ob[getName];
        map[name][setName] = toArray(ob);
    });
}

function toArray(ob) {
    var arr = [],
        count = 0;
    for (var attr in ob) {
        var year = parseInt(attr);
        if (year >= startYear && year <= endYear) {
            var value = parseFloat(ob[attr]);
            if (!isNaN(value)) {
                count++;
            }
            arr[year - startYear] = value;
        }
    }
    if (count >= validLimit)
        return arr;
    else
        return null;
}

function getPath(arr) {
    var path = [];
    path[0] = "M " + arr[0];
    for (var i = 1; i < span; i++) {
        path[i] = "L " + arr[i];
    }
    return path.join(" ");
}

function getDistance(p1, p2) {
    var dx = p1[0] - p2[0],
        dy = p1[1] - p2[1];
    return Math.sqrt(dx * dx + dy * dy);
}

function getMin(attr) {
    return d3.min(nations.map(nation => d3.min(nation[attr])));
}

function getMax(attr) {
    return d3.max(nations.map(nation => d3.max(nation[attr])));
}

function update(index) {
    circles.attr("cx", d => scaleX(d.gdp[index]))
        .attr("cy", d => scaleY(d.life[index]))
        .attr("r", d => scaleR(d.pop[index]));
    yearLabel.text(index + startYear);
}

function dragStarted(d) {
    mouseIsDown = true;
    if (!d3.select(this).classed("selected")) {
        selectNation(d, this);
    }
}

function dragging(d) {
    var index,
        dist,
        minDist = Infinity,
        mousePos = [d3.event.x, d3.event.y];
    d.points.forEach((p, i) => {
        dist = getDistance(p, mousePos);
        if (dist < minDist) {
            minDist = dist;
            index = i;
        }
    });
    update(index);
}

function dragEnded(d) {
    mouseIsDown = false;
    mouseleaved(d);
}

function mouseentered(nation, index) {
    if (!mouseIsDown) {
        //hightlight hovered circle
        circles.classed("notHovered", (d, i) => i !== index);
        //show nation name
        nationLabel.text(nation.name);
        //draw trail
        gTrail.append("path")
            .attr("class", "lineTrajectory")
            .attr("d", getPath(nation.points));
        //animate color change of trail
        var i = 0;
        nation.intervalNumber = setInterval(function () {
            gTrail.append("path")
                .attr("class", "trailSegment")
                .attr("d", "M " + nation.points[i] +
                    " L " + nation.points[i + 1]);
            if (++i >= span - 1) {
                clearInterval(nation.intervalNumber);
            }
        }, 16);
    }
}

function mouseleaved(nation) {
    if (!mouseIsDown) {
        circles.classed("notHovered", false);
        nationLabel.text("");
    }
    //stop uncompleted animation if any
    clearInterval(nation.intervalNumber);
    //remove trail
    gTrail.html("");
}

function selectNation(nation, node) {
    d3.select(node).classed("selected", true);
    gTrailSelected.append("path")
        .datum(nation)
        .attr("d", getPath(nation.points))
        .attr("class", "lineTrajectory");
}

function deSelectNation(nation, node) {
    d3.select(node).classed("selected", false);
    gTrailSelected.filter(d => d == nation).remove();
}

var Interpolator = /** @class */ (function () {
    function Interpolator(array) {
        this.array = array;
        var index,
            element;
        for (index = 0; index < array.length; index++) {
            element = array[index];
            if (!isNaN(element)) {
                if (this.index1 == undefined) {
                    this.index1 = index;
                } else if (this.index2 == undefined) {
                    this.index2 = index;
                } else {
                    break;
                }
            }
        }
        this.scale = d3.scaleLinear()
            .domain([this.index1, this.index2])
            .range([array[this.index1], array[this.index2]]);
        for (index = 0; index < array.length; index++) {
            element = array[index];
            if (!isNaN(element)) {
                this.indexFirst = index;
                break;
            }
        }
        for (index = 0; index < array.length; index++) {
            element = array[array.length - 1 - index];
            if (!isNaN(element)) {
                this.indexLast = index;
                break;
            }
        }
    }
    Interpolator.prototype.interpolate = function (index) {
        if (index > this.indexLast) {
            return this.array[this.indexLast];
        }
        if (index < this.indexFirst) {
            return this.array[this.indexFirst];
        }
        if (index > this.index2) {
            var next = undefined;
            for (var index_1 = this.index2 + 1; index_1 < this.array.length; index_1++) {
                var element = this.array[index_1];
                if (!isNaN(element)) {
                    next = index_1;
                    break;
                }
            }
            if (next != undefined) {
                this.index1 = this.index2;
                this.index2 = next;
            }
            this.scale = d3.scaleLinear()
                .domain([this.index1, this.index2])
                .range([this.array[this.index1], this.array[this.index2]]);
        }
        return this.scale(index);
    };
    return Interpolator;
}());
