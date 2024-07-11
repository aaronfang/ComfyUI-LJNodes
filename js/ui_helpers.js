import { app } from "../../scripts/app.js";
import { clickedOnGroupTitle, 
         addNodesToGroup, 
         getOutputNodesFromSelected, 
         defaultGetSlotMenuOptions, 
         distributeNodesEvenly, 
         alignSelectedNodes
       } from "./utils.js";

const LJNODES_NODE_TITLE_EDIT_TRIGGER = "Comfy.LJNodes.UIHelpers.NodeTitleEditTrigger";
const LJNODES_NODE_TITLE_EDIT_TRIGGER_DEFAULT = "Double Click";
const LJNODES_GROUP_PADDING = "Comfy.LJNodes.UIHelpers.GroupPadding";
const LJNODES_GROUP_PADDING_DEFAULT = 10;

app.registerExtension({
  name: "Comfy.LJNodes.UIHelpers",

  init() {
    // UI Setting: Node Title Edit Trigger
    const defaultTrigger = LJNODES_NODE_TITLE_EDIT_TRIGGER_DEFAULT;
    app.ui.settings.addSetting({
      id: LJNODES_NODE_TITLE_EDIT_TRIGGER,
      name: "🧈 LJNodes: Node Title Edit Trigger",
      defaultValue: defaultTrigger,
      type: "combo",
      options: (value) =>
        [defaultTrigger, "F2"].map((m) => ({
          value: m,
          text: m,
          selected: m === value,
        })),
    });

    // UI Setting: Group Padding
    const defaultPadding = LJNODES_GROUP_PADDING_DEFAULT;
    app.ui.settings.addSetting({
      id: LJNODES_GROUP_PADDING,
      name: "🧈 LJNodes: Group Padding",
      defaultValue: defaultPadding,
      type: "number",
    });
  },

  async nodeCreated(node, app) {
    let orig_dblClick = node.onDblClick;
    node.onDblClick = function (e, pos, self) {
      orig_dblClick?.apply?.(this, arguments);
      const setting = app.ui.settings.getSettingValue(LJNODES_NODE_TITLE_EDIT_TRIGGER, LJNODES_NODE_TITLE_EDIT_TRIGGER_DEFAULT);
      if (setting === LJNODES_NODE_TITLE_EDIT_TRIGGER_DEFAULT) {
        if(pos[1] > 0) return;
        let prompt = window.prompt("Title", this.title);
        if (prompt) { this.title = prompt; }
      }
    }
  },
});

const origProcessKey = LGraphCanvas.prototype.processKey;
LGraphCanvas.prototype.processKey = function(e) {
  if (!this.graph) {
    return;
  }

  var block_default = false;

  if (e.target.localName == "input") {
    return;
  }

  if (e.type == "keydown" && !e.repeat) {
    // Ctrl + G, Add Group For Selected Nodes
    if (e.key === 'g' && e.ctrlKey) {
      if (Object.keys(app.canvas.selected_nodes || {}).length) {
        var group = new LiteGraph.LGraphGroup();
        const padding = app.ui.settings.getSettingValue(LJNODES_GROUP_PADDING, LJNODES_GROUP_PADDING_DEFAULT);
        addNodesToGroup(group, this.selected_nodes, padding);
        app.canvas.graph.add(group);
      }
      block_default = true;
    }

    // Ctrl + Q, Queue Selected Output Nodes (rgthree) 
    if (e.key === 'q' && e.ctrlKey) {
      const outputNodes = getOutputNodesFromSelected(app.canvas);
      if (outputNodes.length) {
        rgthree.queueOutputNodes(outputNodes.map((n) => n.id));
      }
      block_default = true;
    }

    // F2, Rename Selected Node
    if (e.key === 'F2') {
      const setting = app.ui.settings.getSettingValue(LJNODES_NODE_TITLE_EDIT_TRIGGER, LJNODES_NODE_TITLE_EDIT_TRIGGER_DEFAULT);
      if (setting === "F2") {
        if (Object.keys(app.canvas.selected_nodes || {}).length === 1) {
          const node = app.canvas.selected_nodes[Object.keys(app.canvas.selected_nodes)[0]];
          let prompt = window.prompt("Title", node.title);
          if (prompt) { node.title = prompt; }
          block_default = true;
        }
      }
    }

    // ctrl + ArrowKey, Align Selected Nodes
    if (e.ctrlKey && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      const nodes = app.canvas.selected_nodes;
      if (Object.keys(nodes).length > 1) {
        if (e.key === "ArrowUp") {
          alignSelectedNodes(nodes, "up");
        } else if (e.key === "ArrowDown") {
          alignSelectedNodes(nodes, "down");
        }else if (e.key === "ArrowLeft") {
          alignSelectedNodes(nodes, "left");
        }else if (e.key === "ArrowRight") {
          alignSelectedNodes(nodes, "right");
        }
        block_default = true;
      }
    }

    // shift + ArrowKey, Distribute Vertical/Horizontal Spacing
    if (e.shiftKey && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      const nodes = app.canvas.selected_nodes;
      if (Object.keys(nodes).length > 2) {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          distributeNodesEvenly(nodes, "horizontal");
        } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          distributeNodesEvenly(nodes, "vertical");
        }
        block_default = true;
      }
    }
  }

  this.graph.change();

  if (block_default) {
    e.preventDefault();
    e.stopImmediatePropagation();
    return false;
  }

  return origProcessKey.apply(this, arguments);
};

// NOTE: LGraphNode.prototype.getSlotMenuOptions does not exist, no need to override.
LGraphNode.prototype.getSlotMenuOptions = function (slot) {
  let options = defaultGetSlotMenuOptions(slot);

  if (slot.output?.links?.length) {
    options.push({
      content: "Add Reroute in between",
      callback: () => {
        // create a reroute node
        let reroute = LiteGraph.createNode("Reroute");
        reroute.pos = [this.pos[0] + this.size[0] + 24, this.pos[1]];
        app.graph.add(reroute, false);
        // copy the connections to the reroute node
        let links = [...slot.output.links];
        for (let i in links) {
            let link = app.graph.links[links[i]];
            let target_node = app.graph.getNodeById(link.target_id);
            reroute.connect(0, target_node, link.target_slot);
        }
        // disconnect the original node
        this.disconnectOutput(slot.slot);
        // connect to the new reroute node
        this.connect(slot.slot, reroute, 0);
        app.graph.afterChange();
      },
    });
  }
  return options;
}
