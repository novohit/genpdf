const { captureD3Chart } = require('./bar');
const { capturePieChart } = require('./pie');
const { captureRelationshipGraph } = require('./relationship');
const { captureStreamGraph } = require('./streamgraph');

module.exports = {
    captureD3Chart,
    capturePieChart,
    captureRelationshipGraph,
    captureStreamGraph
}; 