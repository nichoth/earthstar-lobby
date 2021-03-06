import styled from "styled-components/macro";

const TextArea = styled.textarea`
  display: block;
  width: calc(100% - 2px);
  color: ${(props) => props.theme.colours.fg};
  border: 1px solid ${(props) => props.theme.colours.fg};
  background: ${(props) => props.theme.colours.inputBg};
  font: ${(props) => `${props.theme.font.size}px ${props.theme.font.family}`};
  margin: 0;
  padding: 12px 8px;
  box-sizing: border-box;
`;

export default TextArea;
