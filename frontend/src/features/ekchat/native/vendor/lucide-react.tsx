import React from 'react'
import type { ComponentType, SVGProps } from 'react'

import MenuIcon from '@mui/icons-material/Menu'
import AddIcon from '@mui/icons-material/Add'
import LightModeIcon from '@mui/icons-material/LightMode'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import SearchIcon from '@mui/icons-material/Search'
import HistoryIcon from '@mui/icons-material/History'
import DescriptionIcon from '@mui/icons-material/Description'
import LayersIcon from '@mui/icons-material/Layers'
import EditIcon from '@mui/icons-material/Edit'
import SendIcon from '@mui/icons-material/Send'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import PublicIcon from '@mui/icons-material/Public'
import UploadIcon from '@mui/icons-material/Upload'
import DeleteIcon from '@mui/icons-material/Delete'
import CloseIcon from '@mui/icons-material/Close'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import FormatBoldIcon from '@mui/icons-material/FormatBold'
import FormatItalicIcon from '@mui/icons-material/FormatItalic'
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined'
import StrikethroughSIcon from '@mui/icons-material/StrikethroughS'
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted'
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered'
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft'
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter'
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight'
import FormatAlignJustifyIcon from '@mui/icons-material/FormatAlignJustify'
import UndoIcon from '@mui/icons-material/Undo'
import RedoIcon from '@mui/icons-material/Redo'
import LinkIcon from '@mui/icons-material/Link'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import FormatClearIcon from '@mui/icons-material/FormatClear'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import AutorenewIcon from '@mui/icons-material/Autorenew'

type IconProps = {
  size?: number
  className?: string
  style?: React.CSSProperties
} & Omit<SVGProps<SVGSVGElement>, 'ref'>

function wrapMuiIcon(Icon: ComponentType<any>) {
  return function WrappedIcon({ size = 18, style, ...rest }: IconProps) {
    return <Icon style={{ width: size, height: size, ...style }} {...rest} />
  }
}

export const Menu = wrapMuiIcon(MenuIcon)
export const Plus = wrapMuiIcon(AddIcon)
export const Sun = wrapMuiIcon(LightModeIcon)
export const Moon = wrapMuiIcon(DarkModeIcon)
export const MessageCircle = wrapMuiIcon(ChatBubbleOutlineIcon)
export const Sparkles = wrapMuiIcon(AutoAwesomeIcon)
export const Search = wrapMuiIcon(SearchIcon)
export const History = wrapMuiIcon(HistoryIcon)
export const FileText = wrapMuiIcon(DescriptionIcon)
export const Layers = wrapMuiIcon(LayersIcon)
export const Edit3 = wrapMuiIcon(EditIcon)
export const Send = wrapMuiIcon(SendIcon)
export const Paperclip = wrapMuiIcon(AttachFileIcon)
export const Globe = wrapMuiIcon(PublicIcon)
export const Upload = wrapMuiIcon(UploadIcon)
export const Trash2 = wrapMuiIcon(DeleteIcon)
export const X = wrapMuiIcon(CloseIcon)
export const ChevronLeft = wrapMuiIcon(ChevronLeftIcon)
export const ChevronRight = wrapMuiIcon(ChevronRightIcon)

export const Bold = wrapMuiIcon(FormatBoldIcon)
export const Italic = wrapMuiIcon(FormatItalicIcon)
export const Underline = wrapMuiIcon(FormatUnderlinedIcon)
export const Strikethrough = wrapMuiIcon(StrikethroughSIcon)
export const List = wrapMuiIcon(FormatListBulletedIcon)
export const ListOrdered = wrapMuiIcon(FormatListNumberedIcon)
export const AlignLeft = wrapMuiIcon(FormatAlignLeftIcon)
export const AlignCenter = wrapMuiIcon(FormatAlignCenterIcon)
export const AlignRight = wrapMuiIcon(FormatAlignRightIcon)
export const AlignJustify = wrapMuiIcon(FormatAlignJustifyIcon)
export const Undo = wrapMuiIcon(UndoIcon)
export const Redo = wrapMuiIcon(RedoIcon)
export const Link2 = wrapMuiIcon(LinkIcon)
export const Unlink = wrapMuiIcon(LinkOffIcon)
export const Eraser = wrapMuiIcon(FormatClearIcon)
export const Copy = wrapMuiIcon(ContentCopyIcon)
export const ArrowDown = wrapMuiIcon(ArrowDownwardIcon)
export const RotateCcw = wrapMuiIcon(AutorenewIcon)
