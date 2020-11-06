import * as React from "react";
import MaterialTable, { Column, MTableToolbar } from "material-table";
import {
  createStyles,
  lighten,
  makeStyles,
  Theme,
  withStyles,
} from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import { rpoInfoIcons } from "../helper/rpoInfoIcons";
import { RpoInfoPanelAction } from "../actions";
import FilterList from "@material-ui/icons/FilterList";
import { cellDefaultStyle } from "./rpoInfoInterface";
import { IMemento, useMemento } from "../helper/memento";
import {
  propPageSize,
  DEFAULT_TABLE,
  propColumnHidden,
  propColumns,
  propOrderBy,
  propOrderDirection,
  propColumnsOrder
} from "./rpoInfoPanelMemento";
import { i18n } from "../helper";
import RpoInfoTheme, { inputTextStyles, useToolbarStyles } from "../helper/theme";
import { IRpoInfoData, IRpoPatch } from "../rpoPath";
import { FilledInput, FormControl, Grid, Input, InputLabel, SvgIconProps, Typography } from "@material-ui/core";
import TreeView from '@material-ui/lab/TreeView';
import TreeItem, { TreeItemProps } from '@material-ui/lab/TreeItem';
import TextField from '@material-ui/core/TextField';
import Label from '@material-ui/icons/Label';

interface RenderTree {
  name: string;
  children?: RenderTree[];
  rpoPatch?: IRpoPatch;
}


interface IRpoInfoPanel {
  vscode: any;
  memento: any;
}

let listener = undefined;

interface ITitleProps {
  title: string;
  subtitle: string;
}

function Title(props: ITitleProps) {
  const style = useToolbarStyles();

  return (
    <>
      <div className={style.title}>{props.title}</div>
      <div className={style.subtitle}>{props.subtitle}</div>
    </>
  );
}

const useTreeItemStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      color: theme.palette.text.secondary,
      '&:hover > $content': {
        backgroundColor: theme.palette.action.hover,
      },
      '&:focus > $content, &$selected > $content': {
        backgroundColor: `var(--tree-view-bg-color, ${theme.palette.grey[400]})`,
        color: 'var(--tree-view-color)',
      },
      '&:focus > $content $label, &:hover > $content $label, &$selected > $content $label': {
        backgroundColor: 'transparent',
      },
    },
    content: {
      color: theme.palette.text.secondary,
      borderTopRightRadius: theme.spacing(2),
      borderBottomRightRadius: theme.spacing(2),
      paddingRight: theme.spacing(1),
      fontWeight: theme.typography.fontWeightMedium,
      '$expanded > &': {
        fontWeight: theme.typography.fontWeightRegular,
      },
    },
    group: {
      marginLeft: 0,
      '& $content': {
        paddingLeft: theme.spacing(2),
      },
    },
    expanded: {},
    selected: {},
    label: {
      fontWeight: 'inherit',
      color: 'inherit',
    },
    labelRoot: {
      display: 'flex',
      alignItems: 'center',
      padding: theme.spacing(0.5, 0),
    },
    labelIcon: {
      marginRight: theme.spacing(1),
    },
    labelText: {
      fontWeight: 'inherit',
      flexGrow: 1,
    },
  }),
);

type StyledTreeItemProps = TreeItemProps & {
  bgColor?: string;
  color?: string;
  labelIcon: React.ElementType<SvgIconProps>;
  labelInfo?: string;
  labelText: string;
};

declare module 'csstype' {
  interface Properties {
    '--tree-view-color'?: string;
    '--tree-view-bg-color'?: string;
  }
}

function StyledTreeItem(props: StyledTreeItemProps) {
  const classes = useTreeItemStyles();
  const { labelText, labelIcon: LabelIcon, labelInfo, color, bgColor, ...other } = props;

  return (
    <TreeItem
      label={
        <div className={classes.labelRoot}>
          <LabelIcon color="inherit" className={classes.labelIcon} />
          <Typography variant="body2" className={classes.labelText}>
            {labelText}
          </Typography>
          <Typography variant="caption" color="inherit">
            {labelInfo}
          </Typography>
        </div>
      }
      classes={{
        root: classes.root,
        content: classes.content,
        expanded: classes.expanded,
        selected: classes.selected,
        group: classes.group,
        label: classes.label,
      }}
      {...other}
    />
  );
}

function buildColumns(memento: IMemento): [] {
  let columns = propColumns({ ...cellDefaultStyle }).columns;
  const orderBy = memento.get(propOrderBy()) || "";
  const defaultSort =
    orderBy === -1 ? "" : memento.get(propOrderDirection()) || "asc";
  let columnsOrder: any[] = memento.get(propColumnsOrder()) || [];

  for (let index = 0; index < columns.length; index++) {
    const value = memento.get(propColumnHidden(columns[index].field));

    if (value !== undefined) {
      columns[index]["hiddenByColumnsButton"] = value;
      columns[index]["hidden"] = value;
    }

    if (orderBy === columns[index]["field"]) {
      columns[index]["defaultSort"] = defaultSort;
    }

    try {
      const orderColumn: any = columnsOrder.find((column: any) => {
        return column.field === columns[index]["field"];
      });

      if (orderColumn) {
        columns[index]["columnOrder"] = orderColumn.columnOrder;
      }
    } catch (error) {
      columnsOrder = [];
    }
  }

  if (columnsOrder.length > 0) {
    columns = columns.sort(function (a: any, b: any): any {
      return a.columnOrder - b.columnOrder;
    });
  }

  return columns;
}

let memento: IMemento = undefined;

export default function RpoLogPanel(props: IRpoInfoPanel) {
  memento = useMemento(
    props.vscode,
    "RPO_INFO_PANEL",
    RpoInfoPanelAction.DoUpdateState,
    DEFAULT_TABLE(),
    props.memento
  );

  const [rows, setRows] = React.useState([]);
  const [currentNode, setCurrentNode] = React.useState<IRpoPatch>();
  const [data, setData] = React.useState<RenderTree>();
  const [subtitle, setSubtitle] = React.useState();
  const [rpoInfo, setRpoInfo] = React.useState<any>(null);
  const [pageSize, setPageSize] = React.useState(memento.get(propPageSize()));
  const [filtering, setFiltering] = React.useState(false);
  const [columns] = React.useState(buildColumns(memento));

  if (listener === undefined) {
    listener = (event: MessageEvent) => {
      const message = event.data; // The JSON data our extension sent

      switch (message.command) {
        case RpoInfoPanelAction.UpdateRpoInfo: {
          const rpoInfo: IRpoInfoData = message.data.rpoInfo as IRpoInfoData;
          const nodes: RenderTree = { name: rpoInfo.environment, children: [] };

          rpoInfo.rpoPatchs.forEach((rpoPatch: IRpoPatch) => {
            const name = rpoPatch.dateFileApplication.split(" ")[0];
            if (!nodes.children.find((element: any) => element.name == name)) {
              nodes.children.push({ name: name, rpoPatch: rpoPatch })
            }
          });

          setData(nodes);
          setSubtitle(message.data.serverName);
          setRpoInfo({ version: rpoInfo.rpoVersion, date: rpoInfo.dateGeneration, environment: rpoInfo.environment });
          break;
        }
        default:
          console.log("***** ATTENTION: rpoInfoPanel.tsx");
          console.log("\tCommand not recognized: " + message.command);
          break;
      }
    };

    window.addEventListener("message", listener);
  }

  const doColumnHidden = (column: Column<any>, hidden: boolean) => {
    memento.set(propColumnHidden(column.field as string, hidden));
  };

  const doOrderChange = (orderBy: number, direction: string) => {
    const columns = propColumns().columns;

    memento.set(propOrderBy(columns[orderBy]["field"]));
    memento.set(propOrderDirection(direction));
  };

  const doChangeRowsPerPage = (value: number) => {
    setPageSize(value);
    memento.set(propPageSize(value));
  };

  const actions = [];

  actions.push({
    icon: () =>
      filtering ? <FilterList className={toolBarStyle.actionOn} /> : <FilterList />,
    tooltip: i18n.localize("FILTERING_ON_OFF", "Filtering on/off"),
    isFreeAction: true,
    onClick: () => {
      setFiltering(!filtering);
    },
  });

  const hashCode = (s: string) => s.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0)

  const doClickNode = (event: React.MouseEvent<HTMLElement, MouseEvent>, name: string) => {
    event.preventDefault();

    const currentNode: RenderTree[] = data.children.filter((element: RenderTree) => element.name == name);
    if (currentNode.length == 1) {
      setRows(currentNode[0].rpoPatch.programsApp);
      setCurrentNode(currentNode[0].rpoPatch);
    } else {
      setRows([]);
      setCurrentNode(null);
    }
  }

  const renderTree = (nodes: RenderTree) => (
    <StyledTreeItem
      nodeId={"node_" + hashCode(nodes.name)}
      labelText={nodes.name}
      labelIcon={Label}
      onClick={(event) => doClickNode(event, nodes.name)}
    >
      {Array.isArray(nodes.children) ? nodes.children.map((node) => renderTree(node)) : null}
    </StyledTreeItem>
  );

  const toolBarStyle = useToolbarStyles();
  const inputTextClasses = inputTextStyles();
  const rpo = rpoInfo || ({ version: "", date: "", environment: "" });

  return (
    <RpoInfoTheme>
      <Paper variant="outlined">
        <Grid container spacing={5}>
          <Grid item xs={2}>
            <Grid container >
              <Grid item container className={inputTextClasses.root}>
                <Typography variant="overline" display="block" gutterBottom>RPO</Typography>
                <TextField margin="dense" label="Date" variant="outlined" disabled size="small" value={rpo.date} />
                <TextField margin="dense" label="Version" variant="outlined" disabled size="small" value={rpo.version} />
              </Grid>

              <Grid item >
                <TreeView
                  defaultExpanded={["node_" + hashCode(rpo.environment)]}
                  defaultCollapseIcon={rpoInfoIcons.arrowDropDown}
                  defaultExpandIcon={rpoInfoIcons.arrowRight}
                  defaultEndIcon={<div style={{ width: 24 }} />}
                >
                  {data && renderTree(data)}
                </TreeView>
              </Grid>
            </Grid>
          </Grid>
          <Grid item xs={10}>
            <MaterialTable
              components={{
                Toolbar: (props) => (
                  <div>
                    <Title
                      title={i18n.localize("RPO_LOG", "Log de Repositórios")}
                      subtitle={
                        subtitle
                          ? subtitle
                          : i18n.localize("INITIALIZING", "(initializing)")
                      }
                    />

                    <Grid container className={inputTextClasses.root}>
                      <Grid item>
                        <Typography variant="overline" display="block" gutterBottom>Generation</Typography>
                        <TextField margin="dense" label="Date" variant="outlined" disabled size="small" value={currentNode && currentNode.dateFileGeneration} />
                        <TextField margin="dense" label="Build" variant="outlined" disabled size="small" value={currentNode && currentNode.buildFileGeneration} />
                      </Grid>
                      <Grid item>
                        <Typography variant="overline" display="block" gutterBottom>Application</Typography>
                        <TextField margin="dense" label="Date" variant="outlined" disabled size="small" value={currentNode && currentNode.dateFileApplication} />
                        <TextField margin="dense" label="Build" variant="outlined" disabled size="small" value={currentNode && currentNode.buildFileApplication} />
                      </Grid>
                    </Grid>

                    <MTableToolbar {...props} />
                  </div>
                ),
              }}
              localization={i18n.materialTableLocalization}
              icons={rpoInfoIcons.table}
              columns={rows.length ? columns : []}
              data={rows}
              options={{
                searchFieldAlignment: "left",
                searchFieldStyle: { marginLeft: "-16px" },
                showTextRowsSelected: false,
                emptyRowsWhenPaging: false,
                pageSize: pageSize,
                pageSizeOptions: [10, 50, 100],
                paginationType: "normal",
                thirdSortClick: true,
                selection: false,
                grouping: false,
                filtering: filtering,
                exportButton: true,
                padding: "dense",
                actionsColumnIndex: 0,
                columnsButton: true,
                sorting: true,
                showTitle: false,
                toolbarButtonAlignment: "right",
              }}
              actions={actions}
              onChangeRowsPerPage={(value) => doChangeRowsPerPage(value)}
              onChangeColumnHidden={(column, hidden) =>
                doColumnHidden(column, hidden)
              }
              onOrderChange={(orderBy, direction) =>
                doOrderChange(orderBy, direction)
              }
            />
          </Grid>
        </Grid>
      </Paper>
    </RpoInfoTheme>
  );
}
