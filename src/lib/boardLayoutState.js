export function replaceBoardImagePreservingLayout(board, nextBoardImage) {
  if (!board?.images?.length || !nextBoardImage?.id) {
    return board ?? null;
  }

  let didReplace = false;
  const nextImages = board.images.map((image) => {
    if (image.id !== nextBoardImage.id) {
      return image;
    }

    didReplace = true;
    return {
      ...image,
      ...nextBoardImage,
      id: image.id,
      x: image.x,
      y: image.y,
      width: image.width,
      height: image.height,
      zIndex: image.zIndex
    };
  });

  return didReplace
    ? {
        ...board,
        images: nextImages
      }
    : board;
}

export function replaceBoardImageReferencePreservingLayout(board, imageId, referenceId, referenceItemUuid = "") {
  if (!board?.images?.length || !imageId || !referenceId) {
    return board ?? null;
  }

  return replaceBoardImagePreservingLayout(board, {
    id: imageId,
    referenceId,
    referenceItemUuid
  });
}
