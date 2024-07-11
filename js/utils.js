export function clickedOnGroupTitle(e, group) {
  const pos = group.pos;
  const size = group.size;
  const font_size = group.font_size || LiteGraph.DEFAULT_GROUP_FONT_SIZE;
  const height = font_size * 1.4;
  if (LiteGraph.isInsideRectangle(e.canvasX, e.canvasY, pos[0], pos[1], size[0], height)) {
    return true;
  }
  return false;
}

export function getOutputNodesFromSelected(canvas) {
  return (
    (canvas.selected_nodes &&
      Object.values(canvas.selected_nodes).filter((n) => {
        return (
          n.mode != LiteGraph.NEVER &&
          n.constructor.nodeData?.output_node
        );
      })) ||
    []
  );
}

export function addNodesToGroup(group, nodes=[], padding=10) {
  var x1, y1, x2, y2;
  var nx1, ny1, nx2, ny2;
  var node;

  x1 = y1 = x2 = y2 = -1;
  nx1 = ny1 = nx2 = ny2 = -1;

  for (var n of [group._nodes, nodes]) {
      for (var i in n) {
          node = n[i]

          nx1 = node.pos[0]
          ny1 = node.pos[1]
          nx2 = node.pos[0] + node.size[0]
          ny2 = node.pos[1] + node.size[1]

          if (node.type != "Reroute") {
              ny1 -= LiteGraph.NODE_TITLE_HEIGHT;
          }

          if (node.flags?.collapsed) {
              ny2 = ny1 + LiteGraph.NODE_TITLE_HEIGHT;

              if (node?._collapsed_width) {
                  nx2 = nx1 + Math.round(node._collapsed_width);
              }
          }

          if (x1 == -1 || nx1 < x1) {
              x1 = nx1;
          }

          if (y1 == -1 || ny1 < y1) {
              y1 = ny1;
          }

          if (x2 == -1 || nx2 > x2) {
              x2 = nx2;
          }

          if (y2 == -1 || ny2 > y2) {
              y2 = ny2;
          }
      }
  }

  y1 = y1 - Math.round(group.font_size * 1.4);

  group.pos = [x1 - padding, y1 - padding];
  group.size = [x2 - x1 + padding * 2, y2 - y1 + padding * 2];
}

/**
 * A default version of the logic for nodes that do not set `getSlotMenuOptions`.
 * This is necessary because when child nodes define `getSlotMenuOptions`, LiteGraph won't apply its default logic.
 */

export function defaultGetSlotMenuOptions(slot) {
  const menu_info = [];
  if (slot?.output?.links?.length) {
    menu_info.push({ content: "Disconnect Links", slot: slot });
  }
  let inputOrOutput = slot.input || slot.output;
  if (inputOrOutput) {
    if (inputOrOutput.removable) {
      menu_info.push(
        inputOrOutput.locked ? { content: "Cannot remove" } : { content: "Remove Slot", slot },
      );
    }
    if (!inputOrOutput.nameLocked) {
      menu_info.push({ content: "Rename Slot", slot });
    }
  }
  return menu_info;
}

export function distributeNodesEvenly(nodes, direction) {
  if (!nodes) {
    return;
  }

  const canvas = LGraphCanvas.active_canvas;
  const directionIndex = direction === "horizontal" ? 0 : 1;

  // Extract node objects from nodes object
  let nodeArray = Object.values(nodes);

  // Sort nodes by position
  nodeArray.sort((a, b) => a.pos[directionIndex] - b.pos[directionIndex]);

  // Calculate total space, which is the distance between the first and last node
  let totalSpace = nodeArray[nodeArray.length - 1].pos[directionIndex] - nodeArray[0].pos[directionIndex];

  // Calculate total size of nodes, excluding the last node
  let totalSize = nodeArray.slice(0, -1).reduce((total, node) => total + node.size[directionIndex], 0);

  // Calculate space between nodes
  let spaceBetween = (totalSpace - totalSize) / (nodeArray.length - 1);

  // Distribute nodes
  let currentPosition = nodeArray[0].pos[directionIndex] + nodeArray[0].size[directionIndex] + spaceBetween;
  for (let i = 1; i < nodeArray.length - 1; i++) {
    nodeArray[i].pos[directionIndex] = currentPosition;
    currentPosition += nodeArray[i].size[directionIndex] + spaceBetween;
  }

  canvas.dirty_canvas = true;
  canvas.dirty_bgcanvas = true;
};

export function alignSelectedNodes(nodes, direction) {
  if (!nodes || Object.keys(nodes).length < 2) {
    return;
  }

  const nodeArray = Object.values(nodes);
  const gapX = 10; // Small gap between nodes from x
  const gapY = 50; // Small gap between nodes from y

  const getNodeSize = (node) => {
    if (node.flags?.collapsed) {
      return [node._collapsed_width || LiteGraph.NODE_COLLAPSED_WIDTH, 0];
    }
    return node.size;
  };

  const checkOverlap = (axis) => {
    for (let i = 0; i < nodeArray.length; i++) {
      for (let j = i + 1; j < nodeArray.length; j++) {
        const sizeI = getNodeSize(nodeArray[i]);
        const sizeJ = getNodeSize(nodeArray[j]);
        if (axis === 'x') {
          if (!(nodeArray[i].pos[0] + sizeI[0] < nodeArray[j].pos[0] || nodeArray[j].pos[0] + sizeJ[0] < nodeArray[i].pos[0])) {
            return true;
          }
        } else {
          if (!(nodeArray[i].pos[1] + sizeI[1] < nodeArray[j].pos[1] || nodeArray[j].pos[1] + sizeJ[1] < nodeArray[i].pos[1])) {
            return true;
          }
        }
      }
    }
    return false;
  };

  const alignNodesWithoutOverlap = (nodes, direction) => {
    const nodeArray = Object.values(nodes);
    let alignPosition;

    switch (direction) {
      case "left":
        alignPosition = Math.min(...nodeArray.map(node => node.pos[0]));
        nodeArray.forEach(node => node.pos[0] = alignPosition);
        break;
      case "right":
        alignPosition = Math.max(...nodeArray.map(node => node.pos[0] + getNodeSize(node)[0]));
        nodeArray.forEach(node => node.pos[0] = alignPosition - getNodeSize(node)[0]);
        break;
      case "up":
        alignPosition = Math.min(...nodeArray.map(node => node.pos[1]));
        nodeArray.forEach(node => node.pos[1] = alignPosition);
        break;
      case "down":
        alignPosition = Math.max(...nodeArray.map(node => node.pos[1] + getNodeSize(node)[1]));
        nodeArray.forEach(node => node.pos[1] = alignPosition - getNodeSize(node)[1]);
        break;
    }
  };

  switch (direction) {
    case "left":
      if (!checkOverlap('y')) {
        alignNodesWithoutOverlap(nodes, "left");
      } else {
        nodeArray.sort((a, b) => a.pos[0] - b.pos[0]);
        let leftMost = nodeArray[0].pos[0];
        for (let i = 0; i < nodeArray.length; i++) {
          nodeArray[i].pos[0] = leftMost;
          if (i < nodeArray.length - 1) {
            leftMost += getNodeSize(nodeArray[i])[0] + gapX;
          }
        }
      }
      break;

    case "right":
      if (!checkOverlap('y')) {
        alignNodesWithoutOverlap(nodes, "right");
      } else {
        nodeArray.sort((a, b) => b.pos[0] - a.pos[0]);
        let rightMost = nodeArray[0].pos[0] + getNodeSize(nodeArray[0])[0];
        for (let i = 0; i < nodeArray.length; i++) {
          const nodeWidth = getNodeSize(nodeArray[i])[0];
          nodeArray[i].pos[0] = rightMost - nodeWidth;
          if (i < nodeArray.length - 1) {
            rightMost -= (nodeWidth + gapX);
          }
        }
      }
      break;

    case "up":
      if (!checkOverlap('x')) {
        alignNodesWithoutOverlap(nodes, "up");
      } else {
        nodeArray.sort((a, b) => a.pos[1] - b.pos[1]);
        let topMost = nodeArray[0].pos[1];
        for (let i = 0; i < nodeArray.length; i++) {
          nodeArray[i].pos[1] = topMost;
          if (i < nodeArray.length - 1) {
            topMost += getNodeSize(nodeArray[i])[1] + gapY;
          }
        }
      }
      break;

    case "down":
      if (!checkOverlap('x')) {
        alignNodesWithoutOverlap(nodes, "down");
      } else {
        nodeArray.sort((a, b) => b.pos[1] - a.pos[1]);
        let bottomMost = nodeArray[0].pos[1] + getNodeSize(nodeArray[0])[1];
        for (let i = 0; i < nodeArray.length; i++) {
          const nodeHeight = getNodeSize(nodeArray[i])[1];
          nodeArray[i].pos[1] = bottomMost - nodeHeight;
          if (i < nodeArray.length - 1) {
            bottomMost -= (nodeHeight + gapY);
          }
        }
      }
      break;
  }

  // Update canvas
  const canvas = LGraphCanvas.active_canvas;
  canvas.dirty_canvas = true;
  canvas.dirty_bgcanvas = true;
}