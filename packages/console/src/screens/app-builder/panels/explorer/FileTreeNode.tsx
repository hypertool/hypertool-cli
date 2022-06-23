import {
    ListItemIcon,
    Menu,
    MenuItem,
    Icon,
    ListItemText,
    Collapse,
    Divider,
} from "@mui/material";

import { TreeItem, treeItemClasses } from "@mui/lab";
import type { TreeItemProps } from "@mui/lab";
import { alpha, styled } from "@mui/material/styles";
import { useMemo, useState } from "react";
import type { TransitionProps } from "@mui/material/transitions";
import { IPath, IPathNode, TNewFileType } from "../../../../types";
import { useBuilderActions, useContextMenu } from "../../../../hooks";
import { truthy } from "../../../../utils";

import NewScreenDialog from "./NewScreenDialog";

const TransitionComponent = (props: TransitionProps) => {
    return <Collapse {...props} />;
};

interface IStyledTreeItemProps extends TreeItemProps {
    contextMenuOpen: boolean;
}

const StyledTreeItem = styled((props: IStyledTreeItemProps) => (
    <TreeItem {...props} TransitionComponent={TransitionComponent} />
))(({ theme, contextMenuOpen }) => ({
    [`& .${treeItemClasses.iconContainer}`]: {
        "& .close": {
            opacity: 0.3,
        },
    },
    [`& .${treeItemClasses.group}`]: {
        marginLeft: 15,
        paddingLeft: 18,
        borderLeft: `1px dashed ${alpha(theme.palette.text.primary, 0.4)}`,
    },
    [`& > .${treeItemClasses.content}`]: {
        borderStyle: "solid",
        borderWidth: 1,
        borderColor: contextMenuOpen
            ? theme.palette.primary.light
            : "transparent",
    },
}));

export interface IFileTreeNodeProps {
    absolutePath: string;
    name: string;
    onNew: (name: string, type: TNewFileType, parent: IPath) => void;
}

const FileTreeNode = (props: any) => {
    const { node, onNew } = props;
    const { anchor, mouseX, mouseY, onContextMenuOpen, onContextMenuClose } =
        useContextMenu();
    const actions = useBuilderActions();
    const [open, setOpen] = useState(false);

    const directory = node.path?.directory || false;
    const appName = actions.getApp().name;

    const menuItems = useMemo(
        () =>
            [
                node.path?.name === `/${appName}/screens` && {
                    id: "new_screen",
                    text: "New Screen",
                    icon: "wysiwyg",
                    callback: () => {
                        setOpen(true);
                        onContextMenuClose();
                    },
                },
                directory && {
                    id: "new_file",
                    text: "New File",
                    icon: "add_circle",
                    callback: () => {
                        onContextMenuClose();
                    },
                },
                directory && {
                    id: "new_folder",
                    text: "New Folder",
                    icon: "create_new_folder",
                    callback: () => {
                        onContextMenuClose();
                    },
                },
                {
                    id: "copy_path",
                    text: "Copy Path",
                    icon: "file_copy",
                    callback: () => {
                        onContextMenuClose();
                    },
                },
                "<divider>",
                {
                    id: "rename",
                    text: "Rename",
                    icon: "drive_file_rename_outline",
                    callback: () => {
                        onContextMenuClose();
                    },
                },
                {
                    id: "delete",
                    text: "Delete",
                    icon: "delete",
                    callback: () => {
                        onContextMenuClose();
                    },
                },
            ].filter(truthy),
        [appName, directory, node.path?.name, onContextMenuClose],
    );

    return (
        <>
            <NewScreenDialog
                open={open}
                onCreate={(values: any) =>
                    onNew({ ...values, type: "screen", parent: node })
                }
            />
            <StyledTreeItem
                nodeId={node.name}
                label={node.name}
                onContextMenu={onContextMenuOpen}
                contextMenuOpen={Boolean(anchor)}
            >
                {node.children.map((child: IPathNode) => (
                    <FileTreeNode node={child} onNew={onNew} />
                ))}
            </StyledTreeItem>

            <Menu
                anchorReference="anchorPosition"
                anchorPosition={{ top: mouseY - 4, left: mouseX - 4 }}
                open={Boolean(anchor)}
                onClose={onContextMenuClose}
            >
                {menuItems.map((menuItem) => (
                    <>
                        {menuItem !== "<divider>" && (
                            <MenuItem
                                id={menuItem.id}
                                onClick={menuItem.callback}
                            >
                                <ListItemIcon>
                                    <Icon fontSize="small">
                                        {menuItem.icon}
                                    </Icon>
                                </ListItemIcon>
                                <ListItemText>{menuItem.text}</ListItemText>
                            </MenuItem>
                        )}
                        {menuItem === "<divider>" && <Divider />}
                    </>
                ))}
            </Menu>
        </>
    );
};

export default FileTreeNode;
