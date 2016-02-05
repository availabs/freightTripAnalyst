var React = require("react"),
    d3 = require('d3'),
    d3legend  = require('d3-svg-legend'),
    SelectBox = require('react-select'),
    Loading = require('react-loading'),
    colorbrewer = require('colorbrewer'),

    //vis source
    map = require('../utils/viz/renderGeography'),
    // bubble = require('../utils/viz/bubbleCharts'),
    // sunburst = require('../utils/viz/sunburstChart'),
    colors = require('../utils/viz/colorScale'),
    fta_linear_model = {"23":{"naics":"23","a":"2.132","b":"0.059","obs":"66","min":"3","mean":"28","max":"201"},"31":{"naics":"31","a":"1.825","b":"0.032","obs":"54","min":"2","mean":"39","max":"200"},"32":{"naics":"32","a":"-0.153","b":"65","obs":"2","min":"38","mean":"300"},"33":{"naics":"33","a":"2.276","b":"0.075","obs":"83","min":"1","mean":"44","max":"350"},"42":{"naics":"42","a":"3.669","b":"0.081","obs":"227","min":"1","mean":"20","max":"200"},"44":{"naics":"44","a":"2.793","b":"0.143","obs":"180","min":"1","mean":"18","max":"173"},"45":{"naics":"45","a":"3.375","b":"-79","obs":"1","min":"15","mean":"98"},"48":{"naics":"48","a":"10.157","b":"-14","obs":"3","min":"36","mean":"151"},"72":{"naics":"72","a":"1.918","b":"0.070","obs":"102","min":"3","mean":"27","max":"180"},"31-33":{"naics":"31-33","a":"1.427","b":"0.087","obs":"202","min":"1","mean":"41","max":"350"},"44-45":{"naics":"44-45","a":"2.756","b":"0.118","obs":"259","min":"1","mean":"17","max":"173"},"":{"naics":""}},

    colorBrewerSpectral11 = ["#9e0142","#d53e4f","#f46d43","#fdae61","#fee08b","#ffffbf","#e6f598","#abdda4","#66c2a5","#3288bd","#5e4fa2"].reverse(),
    //--data
    naicsLib = require('../utils/data/naicsKey'),
    metros = require('../utils/data/metroAreas').map(function(d){
        return {value:d.fips,label:d.name}
    }),
    years = d3.range(1998,2014).map(function(d){
        return {value:d,label:d}
    }).reverse(),
    centroids = [],
    nf = new Intl.NumberFormat();

var Header = React.createClass({
    
    getDefaultProps:function(){
        return{
            mapWidth:1000,
            mapHeight:600,
        }
    },

    getInitialState:function(){

        return {
            type:'fips',
            metroFips:'104',
            year:'2013',
            geo:{type:'FeatureCollection',features:[]},
            data:[],
            loading:false,
            options:{
                mode:'cluster',
                naics:{
                    depth:0,
                    code:undefined
                }
            },
            colorScale:{},
            type:'fta_linear'
        }
    },

    componentDidMount:function(){
        this.getMetroData(this.state.metroFips)
       //this.loadCsv()
    },

    componentDidUpdate:function(nextProps,nextState){
        //bubble.renderBubbleChart(this.state.data,this.props.mapWidth,this.props.mapHeight,map.centroids,this.state.options);
    },


    loadCsv:function(){
        d3.csv('/react/utils/data/fta_nonlinear_combined.csv', function(err,data){
            console.log('csv',err,data)     
        })
    },
    updateMetro:function(val){

        console.log("Selected: " + val);
        
        this.setState({
            metroFips:val,
            data:[],
            loading:true
        });     
        this.getMetroData(val);
        d3.select("#zip_group").selectAll("path").remove(); // clear  map
        
    },
    


    getYearData:function(){
        var scope =this,
            api = 'http://zbp.availabs.org/';

        var fips  = {"type": "metro", "code": this.state.metroFips};
          
        
        d3.json(api+'/details')
        .post(JSON.stringify({"fips":fips,"year":this.state.year}),function(err,response){
            
            var data = scope.processData(response.data);
            console.log('details data',response.data)
            scope.colorMap(data)
            //scope.getCircleArray(response.data);     
            //sunburst.renderSunburst(data,scope.setNaics);
            
            scope.setState({
                data:data,
                loading:false,
            });

        });
    
    },

    getMetroData:function(fipsCode){
        var scope =this,
            api = 'http://zbp.availabs.org';

        var fips  = {"type": "metro", "code": fipsCode},
            naics = ['23','31','32','33','42','44','45','48','72'];
          
        d3.json(api+'/details')
        .post(JSON.stringify({'fips':fips, 'year':this.state.year, 'naics':naics}),function(err,response){
            var data = scope.processData(response.data);
            scope.getGeography(fips,Object.keys(response.data),function(zips){
            
                map.renderGeography(zips,scope.props.mapWidth,scope.props.mapHeight);
                scope.colorMap(data)

                //sunburst.renderSunburst(data,scope.setNaics);
        
                scope.setState({
                    geo:zips,
                    data:data,
                    loading:false,
                })
            })
        }); 
    },

    colorMap(data){
        var toViz = this.state.type;
        var rawData = Object.keys(data)
            .map(zip => data[zip][toViz])
            .filter(d => d >= 0)
            

        console.log('why no quantiles?',rawData)
        var quantiles = d3.scale.quantile()
            .domain([0,d3.median(rawData),d3.mean(rawData),d3.max(rawData)])
            .range(colorbrewer.Purples[6])
            .quantiles();
            console.log('quantiles',quantiles)

         var colorScale = d3.scale.threshold()
             .domain(quantiles)
             .range(colorbrewer.Purples[6]);

        var colorScale = d3.scale.threshold()
             .domain(quantiles)
             .range(colorbrewer.Purples[6]);

        //console.log('colormap',quantiles)
       
        Object.keys(data).forEach(zip =>{

            //console.log('color',data[zip][toViz],quantiles(data[zip][toViz]))
            d3.select('.zip_'+zip)
              .style('fill', colorScale(data[zip][toViz]))
        })

        this.renderScale(colorScale,quantiles)



    },


    renderScale(threshold,quantiles){
        d3.select('#scale').selectAll('g').remove()
        var width = 300,
            formatPercent = d3.format(".0%"),
            formatNumber = d3.format(".0f");


        var g = d3.select('#scale').append("g")
            .attr("class", "key")
            .attr("transform", "translate(" + (0) / 2 + "," + 75 / 2 + ")");

        var rects = g.append("g");

        function update() {
            var rect = rects.selectAll(".range")
                .data(threshold.range().map(function(color) {
                  var d = threshold.invertExtent(color);
                  // if (d[0] == null) d[0] = quantiles[0];
                  // if (d[1] == null) d[1] = quantiles[1];
                  // console.log('data',d)
                  return d;
                }));

            rect.enter().append("rect")
                .attr("class", "range")
                .attr("height", 8)
                

            rect
                .attr("x", function(d,i) { return  (width / (threshold.domain().length))*i })
                .attr("width", width / (threshold.domain().length))
                .style("fill", function(d) { 
                    console.log('fill',d[0])
                    return threshold( d[0] || 0 ); })

        }

        update();
        threshold.range().forEach(function(d,i){
            console.log('aaa',d,i)
            g.append('text')
                .attr("class", "caption")
                .attr("x",   ((width / (threshold.domain().length))*i)+5 )
                .attr("y",20)
                .text( isNaN(formatNumber(+threshold.domain()[i-1])) ? 0 : formatNumber(+threshold.domain()[i-1]))
        })
        g.append("text")
            .attr("class", "caption")
            .attr("y", -6)
            .text("Freight Trip Attraction (deliveries / day) ");

    },
    

    processData:function(data){
        var scope  = this,
            circleArray = []

        circleArray = Object.keys(data).map(function(zipkey){
            return Object.keys(data[zipkey]).map(function(naicsKey){
                return Object.keys(data[zipkey][naicsKey]).map(function(sizeKey){
                    var cluster = naicsKey.substr(0,2)
                    // if(cluster !== '--' && naicsLib[cluster].part_of_range){
                    //     cluster =  naicsLib[cluster].part_of_range;
                    // }
                    //console.log('zipkey')
                    return {
                        cluster:cluster,
                        naics:naicsKey,
                        size:sizeKey.split('-')[0],
                        radius:sizeKey.split('-')[0],
                        count:+data[zipkey][naicsKey][sizeKey],
                        zip:zipkey
                    }
                })
            })
        })

        var flat1 = [],
            flat2 = [],
            flat3 = [];
        
        flat1 = flat1.concat.apply(flat1, circleArray);
        flat2 = flat2.concat.apply(flat2, flat1);

        circleArray = circleArray.map(function(d){
            var output = []
            for(var i = 0;i < d.count;i++){
                output.push(d);
            }
            return output;
        })
        
        flat3 = flat3.concat.apply(flat2, circleArray);

        circleArray = flat3.filter(function(d){
            return d.radius !== 'total' && d.count > 0 && d.naics.substr(0,2) !== '--';
        })

        circleArray = circleArray.map(function(d){
            if(d.radius === '1000+'){
                d.radius = 1000;
            }
            return d;
        })

        var empyByCluster = {};
        circleArray.forEach(function(d,i){
            if(d.zip && !empyByCluster[d.zip]){
                empyByCluster[d.zip] = {}
                if(d.cluster && !empyByCluster[d.zip][d.cluster]) empyByCluster[d.zip][d.cluster] = 0;
                empyByCluster[d.zip][d.cluster] += +d.radius * d.count;
            }

        })

        var freightGeneration = {}
        Object.keys(empyByCluster).forEach(function(zip){
            var zipEmployment = empyByCluster[zip];
            if(!freightGeneration[zip]){ freightGeneration[zip] = {fta_linear:0} }
            Object.keys(zipEmployment).forEach(function(naicsKey){
                if(fta_linear_model[naicsKey]){
                    freightGeneration[zip].fta_linear += +fta_linear_model[naicsKey].a + (+fta_linear_model[naicsKey].b*zipEmployment[naicsKey])
                }
            })
        })
        //console.log('num establishments:',circleArray.length)
        return freightGeneration;
    },   

    getGeography:function(fips,zips,cb){

        var api = api = 'http://zbp.availabs.org/';
        d3.json(api+'/geozipcodes')
            .post(JSON.stringify({"zips":zips}),function(err,zipsData){
            
            d3.json(api+'/geozipcodes')
                .post(JSON.stringify({"fips":fips}),function(err,fipsData){

                    //console.log('fipsData',fipsData)
                    fipsData.features[0].properties.type='metro'
                    zipsData.features = zipsData.features.concat(fipsData.features)
                
                cb(zipsData)
            });

        })
    },

    renderControls:function(){

        var zipcodeCount = '',
            estCount = '',
            estEmp = '',
            zipcodeCount = this.state.geo.features.length - 1,
            zips =  this.state.options.mode === 'zips' ? " active" : "";
            

        return (
            <div className='col-md-12'>
                <div className='row'>
                    <div className='col-xs-12' style={{textAlign:'center',padding:6,fontSize:16}}>
                        <strong>

                            <SelectBox
                                name="metroarea"
                                value={this.state.metroFips}
                                options={metros}
                                onChange={this.updateMetro}/>

                        </strong>
                    </div>
                </div>
                <div className='row'>
                    <div className='col-xs-4' style={{textAlign:'center',padding:6,fontSize:14}}>
                        <strong>Year</strong>
                    </div>
                    <div className='col-xs-8' style={{textAlign:'center',padding:6,fontSize:14}}>
                        <SelectBox
                            name="datayear"
                            value={this.state.year}
                            options={years}
                            onChange={this.updateYear}/>
                    </div>
                </div>
                <div className='row'>
                    <div className='col-xs-4' style={{textAlign:'center',padding:6,fontSize:14}}>
                        <strong># Zipcodes</strong>
                    </div>
                    <div className='col-xs-8' style={{textAlign:'center',padding:6,fontSize:14}}>
                        {nf.format(zipcodeCount)}
                    </div>
                </div>
                <div className='row'>
                    <div className='col-xs-12' style={{textAlign:'center',padding:6,fontSize:14}}>
                        <svg id="scale" width='360' height='75' />
                    </div>
                    
                </div>
            </div>
        )
    },


    render:function(){
        
        var loading = (
            <div style={{position:'fixed',top:'50%',left:'50%'}}>
             <Loading type='balls' color='#e3e3e3'  />
            </div>
        )

        if(!this.state.loading){
            loading = <span />
        }

        return (
            <div className="container main">
                <h1>NCFRP 25 Freight Generation Modeling</h1>
                <div className="row">
                    <div className="col-md-12">
                        <div id="nytg-tooltip">
                            <div id="nytg-tooltipContainer">
                                <div className="nytg-department"></div>
                                <div className="nytg-rule"></div>
                                <div className="nytg-name"></div>
                                <div className="nytg-discretion"></div>
                                <div className="nytg-valuesContainer">
                                    <span className="nytg-value"></span>
                                    <span className="nytg-change"></span>
                                </div>
                                <div className="nytg-chart"></div>
                                <div className="nytg-tail"></div>
                            </div>
                        </div>

                        {loading}
                        <svg id='circles' style={{width:this.props.mapWidth,height:this.props.mapHeight}} >
                            <g id='circle_group' />
                            <g id='zip_group' />                            
                        </svg>

                        <div style={{position: 'fixed','top': 60,'left':40,width:330}}>
                            <div className='row'>
                                {this.renderControls()}
                            </div>
                        </div>

                        <div style={{position: 'fixed','top': 100,'right':40,width:330}}>
                            <div className='row'>
                                <svg id="circleLegend" style={{width:300,height:200}} />
                            </div>
                        </div>

                    </div>
                </div>
            </div>

        );
    }
});

module.exports = Header;


