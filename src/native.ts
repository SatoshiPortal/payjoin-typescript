const binary = `index.${process.platform}-${process.arch}`;
const native = require(`../${binary}`);
export default native;