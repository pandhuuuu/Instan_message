import {
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { useState } from "react";
import axios from "axios";
import { getServerConfig, setServerConfig, getServerBaseUrl } from "../../config/serverConfig";

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "0.5rem",
  background: "#1c253b",
  border: "1px solid #464555",
  color: "#dae2fd",
  fontSize: "13.5px",
  fontFamily: "'Inter', sans-serif",
  outline: "none",
};

const labelStyle = {
  display: "block",
  fontSize: "12px",
  fontWeight: "500",
  color: "#918fa1",
  marginBottom: "4px",
  fontFamily: "'Inter', sans-serif",
};

const ServerConfigModal = ({ children }) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const currentConfig = getServerConfig();
  const [host, setHost] = useState(currentConfig.host);
  const [port, setPort] = useState(currentConfig.port);
  const toast = useToast();

  const handleSave = () => {
    const saved = setServerConfig(host, port);
    axios.defaults.baseURL = getServerBaseUrl();
    toast({
      title: "Server Configuration Saved",
      description: `Target server set to: ${getServerBaseUrl()}`,
      status: "success",
      duration: 3000,
      isClosable: true,
      position: "top",
    });
    onClose();
  };

  return (
    <>
      {children ? (
        <span onClick={onOpen}>{children}</span>
      ) : (
        <button
          onClick={onOpen}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "#c3c0ff",
            cursor: "pointer",
          }}
          title="Configure Server IP and Port"
        >
          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>dns</span>
          <span>{host}:{port}</span>
        </button>
      )}

      <Modal isLazy isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(8px)" />
        <ModalContent bg="#131b2e" color="#dae2fd" border="1px solid rgba(255,255,255,0.1)" borderRadius="16px">
          <ModalHeader fontSize="18px" fontWeight="700" fontFamily="'Plus Jakarta Sans', sans-serif">
            🌐 Network Server Configuration
          </ModalHeader>
          <ModalCloseButton color="#918fa1" />
          <ModalBody pb={6} className="space-y-4">
            <div
              className="p-3 rounded-xl text-xs"
              style={{
                background: "rgba(79,70,229,0.08)",
                border: "1px solid rgba(79,70,229,0.25)",
                color: "#c7c4d8",
                lineHeight: 1.5,
              }}
            >
              <strong>IM Client Network Requirement:</strong> Specify the network IP address and port where the IM backend server is listening.
            </div>

            <div>
              <label style={labelStyle}>Server Host / IP Address</label>
              <input
                type="text"
                placeholder="localhost or 192.168.1.x"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Server Port</label>
              <input
                type="text"
                placeholder="5000"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div className="text-xs" style={{ color: "#918fa1" }}>
              Active Target URL:{" "}
              <code style={{ color: "#10b981", background: "#1c253b", padding: "2px 6px", borderRadius: "4px" }}>
                {getServerBaseUrl()}
              </code>
            </div>
          </ModalBody>

          <ModalFooter borderTop="1px solid rgba(255,255,255,0.06)">
            <Button variant="ghost" color="#918fa1" mr={3} onClick={onClose} size="sm">
              Cancel
            </Button>
            <Button
              colorScheme="purple"
              onClick={handleSave}
              size="sm"
              bg="#4f46e5"
              _hover={{ bg: "#4338ca" }}
            >
              Save Configuration
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default ServerConfigModal;
